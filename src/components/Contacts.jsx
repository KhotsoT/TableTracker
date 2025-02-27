import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, FileSpreadsheet, Trash2, AlertCircle } from 'lucide-react'
import { db, SCHOOL_ID } from '../config/firebase'
import { collection, getDocs, addDoc, deleteDoc, query, where, doc, writeBatch, getDoc } from 'firebase/firestore'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { toast } from "./ui/use-toast"

// Add this function before the Contacts component
const formatPhoneNumber = (number) => {
  // Remove any non-digit characters
  const cleaned = number.toString().replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.length === 9) {
    return `+27${cleaned}`;
  }
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `+27${cleaned.slice(1)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('27')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('270')) {
    return `+27${cleaned.slice(3)}`;
  }
  
  // If none of the above, assume it's already formatted or throw error
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  return cleaned;
};

function Contacts() {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, contactId: null })

  // Fetch contacts on component mount
  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      setIsLoading(true)
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts')
      const querySnapshot = await getDocs(contactsRef)
      const contactsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setContacts(contactsList)
    } catch (error) {
      setError('Error fetching contacts: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const saveContactsToFirestore = async (validatedContacts) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const batch = writeBatch(db);
      
      for (const row of validatedContacts) {
        // Format the grade to be consistent
        const formattedGrade = row.grade.toString().trim();
        
        // Add to contacts collection
        const contactRef = doc(collection(db, 'schools', SCHOOL_ID, 'contacts'));
        batch.set(contactRef, {
          student_name: row.student_name.trim(),
          grade: formattedGrade,
          device_id: row.device_id.trim(),
          imei_number: row.imei_number,
          mother_name: row.mother_name.trim(),
          mother_contact: row.mother_contact,
          father_name: row.father_name.trim(),
          father_contact: row.father_contact,
          primary_contact: row.primary_contact.toLowerCase().trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // If device info exists, add to devices collection
        if (row.imei_number && row.device_id) {
          const deviceRef = doc(collection(db, 'schools', SCHOOL_ID, 'devices'));
          batch.set(deviceRef, {
            imei: row.imei_number,
            device_id: row.device_id.trim(),
            student_name: row.student_name.trim(),
            grade: formattedGrade,
            status: 'active',
            last_seen: new Date(),
            assigned_to: contactRef.id
          });
        }
      }

      await batch.commit();
      console.log('Successfully saved contacts:', validatedContacts.length);
      
      // Refresh the contacts list
      await fetchContacts();
      
    } catch (error) {
      console.error('Error saving contacts:', error);
      setError('Error saving contacts: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Template structure for student contacts
  const templateData = [
    {
      student_name: 'Example Student',
      grade: '11A',
      device_id: 'iPad-001',
      imei_number: '123456789012345',
      mother_name: 'Mother Name',
      mother_contact: "'0123456789", // Added quote to preserve leading zero
      father_name: 'Father Name',
      father_contact: "'0123456789", // Added quote to preserve leading zero
      notes: "Mother is automatically set as default contact when both parents exist. Empty parent info will show as N/A. At least one parent contact is required."
    }
  ]

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(templateData)
    
    // Update column widths (removed primary_contact)
    const wscols = [
      { wch: 20 }, // student_name
      { wch: 8 },  // grade
      { wch: 15 }, // device_id
      { wch: 20 }, // imei_number
      { wch: 20 }, // mother_name
      { wch: 15 }, // mother_contact
      { wch: 20 }, // father_name
      { wch: 15 }, // father_contact
      { wch: 40 }  // notes - widened for longer explanation
    ]
    worksheet['!cols'] = wscols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
    XLSX.writeFile(workbook, 'student_device_template.xlsx')
  }

  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target.result);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(worksheet);

          const results = {
            success: 0,
            duplicates: 0,
            errors: []
          };

          // First, get existing contacts to check for duplicates
          const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts');
          const existingContactsSnap = await getDocs(contactsRef);
          const existingContacts = new Map();
          
          existingContactsSnap.forEach(doc => {
            const contact = doc.data();
            // Create more unique key using multiple identifiers
            const key = [
              contact.student_name.toLowerCase(),
              contact.grade.toLowerCase(),
              contact.mother_contact !== 'N/A' ? contact.mother_contact : '',
              contact.father_contact !== 'N/A' ? contact.father_contact : '',
              contact.mother_name !== 'N/A' ? contact.mother_name.toLowerCase() : '',
              contact.father_name !== 'N/A' ? contact.father_name.toLowerCase() : ''
            ].join('_');
            existingContacts.set(key, contact);
          });

          // Process rows and collect valid contacts
          const validContacts = [];
          
          data.forEach((row, index) => {
            try {
              // Basic validation
              if (!row.student_name?.toString().trim()) {
                results.errors.push(`Row ${index + 2}: Student name is required`);
                return; // Skip this row
              }

              const grade = row.grade?.toString().trim();
              if (!grade) {
                results.errors.push(`Row ${index + 2}: Grade is required`);
                return;
              }

              // Clean and prepare parent data
              const motherName = row.mother_name?.toString().trim() || 'N/A';
              const fatherName = row.father_name?.toString().trim() || 'N/A';
              const motherContact = row.mother_contact?.toString().trim() || '';
              const fatherContact = row.father_contact?.toString().trim() || '';

              // Create the same unique key format for the new entry
              const key = [
                row.student_name.trim().toLowerCase(),
                grade.toLowerCase(),
                motherContact ? formatPhoneNumber(motherContact) : '',
                fatherContact ? formatPhoneNumber(fatherContact) : '',
                motherName !== 'N/A' ? motherName.toLowerCase() : '',
                fatherName !== 'N/A' ? fatherName.toLowerCase() : ''
              ].join('_');

              // Check for duplicate
              if (existingContacts.has(key)) {
                results.duplicates++;
                return;
              }

              // Handle parent information
              const motherNameFormatted = motherName !== 'N/A' ? motherName : '';
              const fatherNameFormatted = fatherName !== 'N/A' ? fatherName : '';

              // Validate at least one parent has contact info
              if (!motherContact && !fatherContact) {
                results.errors.push(`Row ${index + 2}: At least one parent contact is required for ${row.student_name}`);
                return;
              }

              // Determine primary contact
              let primaryContact = 'mother';
              if (!motherContact && fatherContact) {
                primaryContact = 'father';
              }

              const contact = {
                student_name: row.student_name.trim(),
                grade: grade.toUpperCase(),
                device_id: row.device_id?.toString().trim() || '',
                imei_number: row.imei_number?.toString() || '',
                mother_name: motherNameFormatted,
                mother_contact: motherContact ? formatPhoneNumber(motherContact) : 'N/A',
                father_name: fatherNameFormatted,
                father_contact: fatherContact ? formatPhoneNumber(fatherContact) : 'N/A',
                primary_contact: primaryContact,
                createdAt: new Date(),
                updatedAt: new Date()
              };

              validContacts.push(contact);
              results.success++;

            } catch (error) {
              results.errors.push(`Row ${index + 2}: ${error.message}`);
            }
          });

          // Save valid contacts
          if (validContacts.length > 0) {
            await saveContactsToFirestore(validContacts);
          }

          // Show results
          let message = `Successfully imported ${results.success} contacts.`;
          if (results.duplicates > 0) {
            message += `\n${results.duplicates} duplicates skipped.`;
          }
          
          toast({
            title: "Import Complete",
            description: message,
            variant: "success"
          });

          // If there were any errors, show them in a separate toast
          if (results.errors.length > 0) {
            toast({
              title: `${results.errors.length} Errors Found`,
              description: results.errors.join('\n'),
              variant: "destructive"
            });
          }

          fetchContacts(); // Refresh the list

        } catch (error) {
          console.error('Processing error:', error);
          setError(error.message);
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message);
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }

    // Reset file input
    event.target.value = '';
  };

  const validateImportData = (data) => {
    const requiredFields = [
      'student_name', 
      'grade', 
      'device_id', 
      'imei_number',
      'mother_name',
      'mother_contact',
      'father_name',
      'father_contact',
      'primary_contact'
    ]
    
    for (let row of data) {
      for (let field of requiredFields) {
        if (!row[field]) {
          setError(`Missing required field: ${field.replace(/_/g, ' ')}`)
          return false
        }
      }

      // Validate IMEI number (should be 15 digits)
      if (!/^\d{15}$/.test(row.imei_number.toString())) {
        setError('Invalid IMEI number format. IMEI should be 15 digits.')
        return false
      }

      // Format and validate phone numbers
      try {
        // Handle mother's contact
        let motherContact = row.mother_contact.toString()
        // If Excel removed the leading zero, add it back
        if (motherContact.length === 9) {
          motherContact = '0' + motherContact
        }
        if (!/^0\d{9}$/.test(motherContact)) {
          setError('Invalid mother contact number. Should be 10 digits starting with 0.')
          return false
        }
        // Update the data with formatted number
        row.mother_contact = motherContact

        // Handle father's contact
        let fatherContact = row.father_contact.toString()
        // If Excel removed the leading zero, add it back
        if (fatherContact.length === 9) {
          fatherContact = '0' + fatherContact
        }
        if (!/^0\d{9}$/.test(fatherContact)) {
          setError('Invalid father contact number. Should be 10 digits starting with 0.')
          return false
        }
        // Update the data with formatted number
        row.father_contact = fatherContact
      } catch (error) {
        setError('Invalid phone number format')
        return false
      }

      // Validate primary contact
      if (!['mother', 'father'].includes(row.primary_contact.toLowerCase())) {
        setError('Primary contact must be either "mother" or "father"')
        return false
      }
    }
    return true
  }

  const exportContacts = () => {
    if (contacts.length === 0) {
      setError('No contacts to export')
      return
    }

    // Remove Firestore-specific fields and format IMEI
    const exportData = contacts.map(({ id, createdAt, updatedAt, ...contact }) => ({
      ...contact,
      // Format IMEI as string with leading zeros
      imei_number: contact.imei_number ? `'${contact.imei_number}` : '' // Adding ' forces Excel to treat it as text
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
   
    // Set column width and format for IMEI column
    const colWidth = [
      { wch: 20 }, // Student Name
      { wch: 10 }, // Grade
      { wch: 15 }, // Device ID
      { wch: 20 }, // IMEI
      { wch: 20 }, // Mother's Contact
      { wch: 20 }, // Father's Contact
    ]
    worksheet['!cols'] = colWidth
   
    // Format IMEI column as text
    const range = XLSX.utils.decode_range(worksheet['!ref'])
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const imeiCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 3 })]
      if (imeiCell) {
        imeiCell.z = '@'
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')
    XLSX.writeFile(workbook, 'student_devices.xlsx')
  }

  const handleDelete = async (contactId) => {
    try {
      setIsLoading(true)
      
      // Get the contact to check if it has a device
      const contactRef = doc(db, 'schools', SCHOOL_ID, 'contacts', contactId)
      const contactSnap = await getDoc(contactRef)
      const contactData = contactSnap.data()
      
      const batch = writeBatch(db)
      
      // Delete from contacts collection
      batch.delete(contactRef)
      
      // If contact has device, delete from devices collection
      if (contactData.device_id) {
        const devicesRef = collection(db, 'schools', SCHOOL_ID, 'devices')
        const deviceQuery = query(devicesRef, where('device_id', '==', contactData.device_id))
        const deviceSnap = await getDocs(deviceQuery)
        
        deviceSnap.docs.forEach(doc => {
          batch.delete(doc.ref)
        })
      }
      
      await batch.commit()
      
      // Update local state
      setContacts(prev => prev.filter(c => c.id !== contactId))
      setDeleteDialog({ open: false, contactId: null })
    } catch (error) {
      console.error('Error deleting contact:', error)
      setError('Failed to delete contact')
    } finally {
      setIsLoading(false)
    }
  }

  const validateContacts = (contacts) => {
    return contacts.map(contact => {
      // Validate IMEI format (15 digits)
      if (contact.imei_number) {
        const imeiString = contact.imei_number.toString()
        if (!/^\d{15}$/.test(imeiString.padStart(15, '0'))) {
          throw new Error(`Invalid IMEI format for student ${contact.student_name}. IMEI must be 15 digits.`)
        }
      }
      
      return {
        ...contact,
        imei_number: contact.imei_number ? contact.imei_number.toString().padStart(15, '0') : null
      }
    })
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Student Device Management</h1>
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-gray-900 hover:text-blue-600 hover:border-blue-600 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Download Template
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Actions */}
      <Card>
        <div className="p-6 flex justify-between items-center border-b">
          <div className="flex items-center gap-4">
            <label 
              className="cursor-pointer flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors px-4 py-2 border-2 border-dashed border-gray-300 hover:border-blue-600 rounded-lg"
            >
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-4 h-4" />
              Import Students
            </label>
          </div>
          <Button 
            variant="outline"
            onClick={exportContacts}
            className="flex items-center gap-2 text-gray-900 bg-blue-50/50 border-0 hover:text-blue-600 transition-colors"
            disabled={contacts.length === 0}
          >
            <Download className="w-4 h-4" />
            Export Data
          </Button>
        </div>
      </Card>

      {/* Contacts Table */}
      <div className="mt-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Grade
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Device ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mother
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Father
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.map((contact, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{contact.student_name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {contact.grade}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {contact.device_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${contact.primary_contact === 'mother' ? 'text-blue-600' : 'text-gray-900'}`}>
                            {contact.mother_name}
                            {contact.primary_contact === 'mother' && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Primary
                              </span>
                            )}
                          </span>
                          <span className="text-sm text-gray-500">{contact.mother_contact}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${contact.primary_contact === 'father' ? 'text-blue-600' : 'text-gray-900'}`}>
                            {contact.father_name}
                            {contact.primary_contact === 'father' && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Primary
                              </span>
                            )}
                          </span>
                          <span className="text-sm text-gray-500">{contact.father_contact}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button 
                        onClick={() => setDeleteDialog({ open: true, contactId: contact.id })}
                        className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => setDeleteDialog({ open, contactId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this contact and their device information.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteDialog.contactId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            Loading...
          </div>
        </div>
      )}
    </div>
  )
}

export default Contacts 