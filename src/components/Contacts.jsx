import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, FileSpreadsheet, Trash2, AlertCircle, X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { db, SCHOOL_ID } from '../config/firebase'
import { collection, getDocs, addDoc, deleteDoc, query, where, doc, writeBatch, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"

// Add this function before the Contacts component
const formatPhoneNumber = (number) => {
  if (!number || number === 'N/A') return 'N/A';
  
  // Remove all spaces, hyphens and other non-digit characters
  let cleaned = number.toString().replace(/[^\d+]/g, '');
  
  // Handle Excel's leading zero removal
  // If the number is 9 digits, assume it's a SA number without the leading zero
  if (cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  
  // If number starts with '0', replace with '+27'
  if (cleaned.startsWith('0')) {
    cleaned = '+27' + cleaned.substring(1);
  }
  
  // If number starts with '27', add '+' prefix
  if (cleaned.startsWith('27')) {
    cleaned = '+' + cleaned;
  }
  
  // If number doesn't have any prefix and is 10 digits (with 0), convert to +27
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = '+27' + cleaned.substring(1);
  }
  
  // Validate the final format
  if (!/^\+27\d{9}$/.test(cleaned)) {
    return 'N/A';
  }
  
  return cleaned;
};

const isValidPhoneNumber = (number) => {
  if (!number || number === 'N/A') return false;
  const formatted = formatPhoneNumber(number);
  return formatted !== 'N/A' && /^\+27\d{9}$/.test(formatted);
};

const formatImeiNumber = (imei) => {
  if (!imei) return '';
  
  // Convert to string and remove any non-digit characters
  let cleaned = imei.toString().replace(/\D/g, '');
  
  // Handle Excel's leading zero removal
  // Pad with leading zeros if less than 15 digits
  cleaned = cleaned.padStart(15, '0');
  
  // Validate the final format
  if (!/^\d{15}$/.test(cleaned)) {
    return '';
  }
  
  return cleaned;
};

function Contacts() {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, contactId: null })
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [importResults, setImportResults] = useState(null);
  const [editContact, setEditContact] = useState(null);
  const [deleteAllDialog, setDeleteAllDialog] = useState({ open: false, grade: null });

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
    const errors = [];
    const successfulContacts = [];
    const duplicates = [];
    
    try {
      const batch = writeBatch(db);
      
      // First, get all existing contacts to check for duplicates
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts');
      const existingContactsSnapshot = await getDocs(contactsRef);
      const existingContacts = existingContactsSnapshot.docs.map(doc => doc.data());
      
      for (const row of validatedContacts) {
        try {
          // Validate required fields
          if (!row.learner_name || !row.grade) {
            errors.push(`Missing required fields for ${row.learner_name || 'unknown learner'}`);
            continue;
          }

          // Check for duplicates (case-insensitive)
          const isDuplicate = existingContacts.some(contact => 
            contact.learner_name.toLowerCase() === row.learner_name.trim().toLowerCase() &&
            contact.grade.toLowerCase() === row.grade.toString().trim().toLowerCase()
          );

          if (isDuplicate) {
            duplicates.push(`${row.learner_name} (Grade ${row.grade})`);
            continue;
          }

          // Validate device info if provided
          if ((row.device_id && !row.imei_number) || (!row.device_id && row.imei_number)) {
            errors.push(`Incomplete device information for ${row.learner_name}. Both device ID and IMEI are required.`);
            continue;
          }

          // Format IMEI if device info is provided
          let formattedImei = '';
          if (row.device_id && row.imei_number) {
            formattedImei = formatImeiNumber(row.imei_number);
            if (!formattedImei) {
              errors.push(`Invalid IMEI format for ${row.learner_name}. IMEI must be 15 digits.`);
              continue;
            }
          }

          // Validate parent contact info and format phone numbers
          const motherContact = formatPhoneNumber(row.mother_contact || 'N/A');
          const fatherContact = formatPhoneNumber(row.father_contact || 'N/A');
          
          const hasValidMotherContact = isValidPhoneNumber(motherContact);
          const hasValidFatherContact = isValidPhoneNumber(fatherContact);
          
          if (!hasValidMotherContact && !hasValidFatherContact) {
            errors.push(`At least one valid parent contact number is required for ${row.learner_name}`);
            continue;
          }

          // Determine primary contact - mother is default if both exist, otherwise use the valid one
          const primaryContact = (hasValidMotherContact && hasValidFatherContact) ? 'mother' : 
                               (hasValidMotherContact ? 'mother' : 'father');

          // Format the grade
          const formattedGrade = row.grade.toString().trim();
          
          // Create contact document reference
          const contactRef = doc(collection(db, 'schools', SCHOOL_ID, 'contacts'));
          
          // Prepare contact data with proper handling of empty/N/A values
          const contactData = {
            learner_name: row.learner_name.trim(),
            grade: formattedGrade,
            device_id: row.device_id?.trim() || '',
            imei_number: formattedImei,
            mother_name: row.mother_name?.trim() || 'N/A',
            mother_contact: motherContact,
            father_name: row.father_name?.trim() || 'N/A',
            father_contact: fatherContact,
            primary_contact: primaryContact,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          // Only create device if all device info is valid
          if (row.device_id && row.imei_number) {
            // Create device document
            const deviceRef = doc(collection(db, 'schools', SCHOOL_ID, 'devices'));
            batch.set(deviceRef, {
              imei: row.imei_number,
              device_id: row.device_id.trim(),
              learner_name: row.learner_name.trim(),
              grade: formattedGrade,
              status: 'active',
              last_seen: new Date(),
              assigned_to: contactRef.id
            });
            
            // Update contact with device reference
            contactData.device_ref = deviceRef.id;
          }

          // Add contact to batch
          batch.set(contactRef, contactData);
          successfulContacts.push(contactData);

        } catch (error) {
          errors.push(`Error processing ${row.learner_name}: ${error.message}`);
          continue;
        }
      }

      // Only commit if we have successful contacts
      if (successfulContacts.length > 0) {
        await batch.commit();
        
        // Create alert for contact import
        try {
          const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts');
          await addDoc(alertsRef, {
            type: 'contacts',
            action: 'import',
            message: `Imported ${successfulContacts.length} contact${successfulContacts.length !== 1 ? 's' : ''}`,
            count: successfulContacts.length,
            duplicates: duplicates.length,
            createdAt: serverTimestamp(),
            status: 'success'
          });
        } catch (error) {
          console.error('Failed to create contact import alert:', error);
          // Don't fail the import if alert creation fails
        }
      }

      // Set import results with duplicates count
      setImportResults({
        success: successfulContacts.length,
        errors: errors,
        duplicates: duplicates.length,
        duplicatesList: duplicates
      });

      // Refresh contacts list
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
      learner_name: 'Example Learner',
      grade: '11A',
      device_id: 'iPad-001',
      imei_number: '123456789012345',
      mother_name: 'Mother Name',
      mother_contact: "'0123456789",
      father_name: 'Father Name',
      father_contact: "'0123456789",
      notes: "Mother is automatically set as default contact when both parents exist. Empty parent info will show as N/A. At least one parent contact is required."
    }
  ]

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([{
      learner_name: '',
      grade: '',
      mother_name: '',
      mother_contact: '',
      father_name: '',
      father_contact: '',
      notes: ''
    }])
    
    // Update column widths (removed primary_contact)
    const wscols = [
      { wch: 20 }, // learner_name
      { wch: 8 },  // grade
      { wch: 20 }, // mother_name
      { wch: 15 }, // mother_contact
      { wch: 20 }, // father_name
      { wch: 15 }, // father_contact
      { wch: 40 }  // notes
    ]
    worksheet['!cols'] = wscols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
    XLSX.writeFile(workbook, 'student_contacts_template.xlsx')
  }

  const handleFileUpload = async (event) => {
    try {
      setIsLoading(true);
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target.result);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(worksheet);

          // Validate basic structure
          if (!data || data.length === 0) {
            throw new Error('File is empty or has invalid format');
          }

          // Map old column names to new ones if necessary
          const mappedData = data.map(row => ({
            learner_name: row.learner_name || row.student_name, // Handle both old and new column names
            grade: row.grade,
            device_id: row.device_id,
            imei_number: row.imei_number,
            mother_name: row.mother_name,
            mother_contact: row.mother_contact,
            father_name: row.father_name,
            father_contact: row.father_contact,
            primary_contact: row.primary_contact || 'mother' // Default to mother if not specified
          }));

          // Validate required columns exist
          const requiredColumns = ['learner_name', 'grade'];
          const firstRow = mappedData[0];
          for (const column of requiredColumns) {
            if (!(column in firstRow)) {
              throw new Error(`Missing required column: ${column}`);
            }
          }

          // Process the data
          await saveContactsToFirestore(mappedData);

          toast({
            title: "Import Successful",
            description: `Successfully processed ${mappedData.length} records`,
            variant: "success"
          });

        } catch (error) {
          console.error('Processing error:', error);
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const validateImportData = (data) => {
    const requiredFields = [
      'learner_name', 
      'grade',
      'mother_name',
      'mother_contact',
      'father_name',
      'father_contact'
    ]
    
    for (let row of data) {
      for (let field of requiredFields) {
        if (!row[field]) {
          setError(`Missing required field: ${field.replace(/_/g, ' ')}`)
          return false
        }
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
    }
    return true
  }

  const exportData = () => {
    try {
      // Sort contacts by grade first
      const sortedContacts = [...contacts].sort((a, b) => {
        // First try to sort numerically
        const gradeA = parseInt(a.grade);
        const gradeB = parseInt(b.grade);
        
        if (!isNaN(gradeA) && !isNaN(gradeB)) {
          return gradeA - gradeB;
        }
        
        // If not numbers, sort alphabetically
        return a.grade.localeCompare(b.grade);
      });

      // Format data to match template structure (removed primary_contact from export)
      const formattedData = sortedContacts.map(contact => ({
        learner_name: contact.learner_name,
        grade: contact.grade,
        mother_name: contact.mother_name === 'N/A' ? '' : contact.mother_name,
        mother_contact: contact.mother_contact === 'N/A' ? '' : contact.mother_contact.replace('+27', '0'),
        father_name: contact.father_name === 'N/A' ? '' : contact.father_name,
        father_contact: contact.father_contact === 'N/A' ? '' : contact.father_contact.replace('+27', '0'),
        notes: contact.notes || ''
      }));

      // Create worksheet with updated column widths
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      
      // Set column widths (removed primary_contact)
      const wscols = [
        { wch: 20 }, // learner_name
        { wch: 8 },  // grade
        { wch: 20 }, // mother_name
        { wch: 15 }, // mother_contact
        { wch: 20 }, // father_name
        { wch: 15 }, // father_contact
        { wch: 40 }  // notes
      ];
      worksheet['!cols'] = wscols;

      // Add header row styling (removed primary_contact)
      XLSX.utils.sheet_add_aoa(worksheet, [
        [
          'learner_name',
          'grade',
          'mother_name',
          'mother_contact',
          'father_name',
          'father_contact',
          'notes'
        ]
      ], { origin: 'A1' });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

      // Save with current date in filename
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `student_contacts_${date}.xlsx`);

      toast({
        title: "Export Successful",
        description: "Contact list has been exported successfully",
        variant: "success"
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

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
      
      // If contact has device_ref, delete from devices collection
      if (contactData.device_ref) {
        const deviceRef = doc(db, 'schools', SCHOOL_ID, 'devices', contactData.device_ref)
        batch.delete(deviceRef)
      }
      
      await batch.commit()
      
      // Update local state
      setContacts(prev => prev.filter(c => c.id !== contactId))
      setDeleteDialog({ open: false, contactId: null })

      toast({
        title: "Contact Deleted",
        description: "Contact and associated device have been deleted",
        variant: "success"
      });

    } catch (error) {
      console.error('Error deleting contact:', error)
      toast({
        title: "Error",
        description: "Failed to delete contact: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false)
    }
  }

  const validateContacts = (contacts) => {
    const errors = [];
    const validatedContacts = [];

    contacts.forEach((contact, index) => {
      const rowNum = index + 2; // Adding 2 to account for header row and 0-based index
      const validatedContact = { ...contact };

      // Format phone numbers
      validatedContact.mother_contact = formatPhoneNumber(contact.mother_contact);
      validatedContact.father_contact = formatPhoneNumber(contact.father_contact);

      // Format IMEI if present
      if (contact.imei_number) {
        const formattedImei = formatImeiNumber(contact.imei_number);
        if (!formattedImei) {
          errors.push(`Invalid IMEI format for ${contact.learner_name}. IMEI must be 15 digits.`);
        }
        validatedContact.imei_number = formattedImei;
      }

      // Check if at least one parent contact is valid
      const hasValidMotherContact = isValidPhoneNumber(validatedContact.mother_contact);
      const hasValidFatherContact = isValidPhoneNumber(validatedContact.father_contact);

      if (!hasValidMotherContact && !hasValidFatherContact) {
        errors.push(`At least one valid parent contact number is required for ${contact.learner_name}`);
      }

      // Set primary contact based on valid numbers
      if (hasValidMotherContact) {
        validatedContact.primary_contact = 'mother';
      } else if (hasValidFatherContact) {
        validatedContact.primary_contact = 'father';
      }

      validatedContacts.push(validatedContact);
    });

    return { errors, validatedContacts };
  };

  // Update the getUniqueGrades function
  const getUniqueGrades = () => {
    const grades = new Set(contacts.map(contact => contact.grade));
    return ['all', ...Array.from(grades).sort((a, b) => {
      // First try to sort numerically
      const gradeA = parseInt(a);
      const gradeB = parseInt(b);
      
      if (!isNaN(gradeA) && !isNaN(gradeB)) {
        return gradeA - gradeB;
      }
      
      // If not numbers, sort alphabetically
      return a.localeCompare(b);
    })];
  };

  // Update the filteredContacts logic
  const filteredContacts = contacts
    .filter(contact => {
      const matchesSearch = searchTerm === '' || 
        contact.learner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.mother_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.father_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.mother_contact.includes(searchTerm) ||
        contact.father_contact.includes(searchTerm);

      const matchesGrade = selectedGrade === 'all' || contact.grade === selectedGrade;

      return matchesSearch && matchesGrade;
    })
    .sort((a, b) => {
      // First try to sort numerically
      const gradeA = parseInt(a.grade);
      const gradeB = parseInt(b.grade);
      
      if (!isNaN(gradeA) && !isNaN(gradeB)) {
        return gradeA - gradeB;
      }
      
      // If not numbers, sort alphabetically
      return a.grade.localeCompare(b.grade);
    });

  // Add function to handle contact update
  const handleUpdateContact = async (updatedContact) => {
    try {
      setIsLoading(true);
      const contactRef = doc(db, 'schools', SCHOOL_ID, 'contacts', updatedContact.id);
      
      await updateDoc(contactRef, {
        ...updatedContact,
        updatedAt: new Date()
      });

      // Create alert for contact update
      try {
        const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts');
        await addDoc(alertsRef, {
          type: 'contacts',
          action: 'update',
          message: `Updated contact: ${updatedContact.learner_name}`,
          contactId: updatedContact.id,
          createdAt: serverTimestamp(),
          status: 'success'
        });
      } catch (error) {
        console.error('Failed to create contact update alert:', error);
        // Don't fail the update if alert creation fails
      }

      // Update local state
      setContacts(prev => prev.map(contact => 
        contact.id === updatedContact.id ? updatedContact : contact
      ));

      setEditContact(null);
      toast({
        title: "Contact Updated",
        description: "Contact information has been updated successfully",
        variant: "success"
      });
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function to handle bulk deletion
  const handleDeleteAll = async (grade) => {
    try {
      setIsLoading(true);
      const batch = writeBatch(db);
      
      // Get all contacts for the selected grade
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts');
      const gradeQuery = query(contactsRef, where('grade', '==', grade));
      const querySnapshot = await getDocs(gradeQuery);
      
      // Add delete operations to batch
      querySnapshot.forEach((docSnapshot) => {
        const contactData = docSnapshot.data();
        
        // Delete contact
        batch.delete(docSnapshot.ref);
        
        // If contact has device_ref, delete from devices collection
        if (contactData.device_ref) {
          const deviceRef = doc(db, 'schools', SCHOOL_ID, 'devices', contactData.device_ref);
          batch.delete(deviceRef);
        }
      });
      
      await batch.commit();
      
      // Create alert for bulk delete
      try {
        const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts');
        await addDoc(alertsRef, {
          type: 'contacts',
          action: 'delete',
          message: `Deleted all contacts for Grade ${grade}`,
          grade: grade,
          count: querySnapshot.size,
          createdAt: serverTimestamp(),
          status: 'success'
        });
      } catch (error) {
        console.error('Failed to create delete alert:', error);
        // Don't fail the delete if alert creation fails
      }
      
      // Reset grade filter to 'all' and refresh contacts
      setSelectedGrade('all');
      setDeleteAllDialog({ open: false, grade: null });
      
      // Refresh contacts list to show all grades
      await fetchContacts();
      
      toast({
        title: "Contacts Deleted",
        description: `All contacts and their devices for Grade ${grade} have been deleted`,
        variant: "success"
      });
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast({
        title: "Error",
        description: "Failed to delete contacts: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Learner Management</h1>
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
              Import Learners
            </label>
          </div>
          <Button 
            variant="outline"
            onClick={exportData}
            className="flex items-center gap-2 text-gray-900 bg-blue-50/50 border-0 hover:text-blue-600 transition-colors"
            disabled={contacts.length === 0}
          >
            <Download className="w-4 h-4" />
            Export Data
          </Button>
        </div>
      </Card>

      {/* Search and Grade Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {getUniqueGrades().map(grade => (
              <option key={grade} value={grade}>
                {grade === 'all' ? 'All Grades' : `Grade ${grade}`}
              </option>
            ))}
          </select>
          {selectedGrade !== 'all' && (
            <Button
              variant="destructive"
              onClick={() => setDeleteAllDialog({ open: true, grade: selectedGrade })}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="mt-8 w-full">
        <Card className="overflow-hidden w-full">
          <div className="w-full">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Learner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Grade
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
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact, index) => (
                    <tr 
                      key={index} 
                      className="hover:bg-gray-50 cursor-pointer" 
                      onClick={() => setEditContact(contact)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{contact.learner_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {contact.grade}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog({ open: true, contactId: contact.id });
                          }}
                          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-lg font-medium text-gray-900 mb-1">No contacts found</p>
                        <p className="text-sm text-gray-500">
                          {searchTerm ? 'Try adjusting your search' : 'No contacts available'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
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

      {importResults && (
        <Dialog open={!!importResults} onOpenChange={() => setImportResults(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Import Results</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex flex-col gap-4">
                {importResults.success > 0 && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-3 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                    <span>{importResults.success} contacts successfully imported</span>
                  </div>
                )}
                
                {importResults.duplicates > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-4 py-3 rounded-lg">
                      <AlertTriangle className="h-5 w-5" />
                      <span>{importResults.duplicates} duplicate entries skipped</span>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      <ul className="list-disc list-inside space-y-1">
                        {importResults.duplicatesList.map((duplicate, index) => (
                          <li key={index} className="text-yellow-700 text-sm">
                            Duplicate entry: {duplicate}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {importResults.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span className="font-medium">Errors found:</span>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      <ul className="list-disc list-inside space-y-1">
                        {importResults.errors.map((error, index) => (
                          <li key={index} className="text-red-600 text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setImportResults(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editContact && (
        <Dialog open={!!editContact} onOpenChange={() => setEditContact(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateContact(editContact);
            }}>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Learner Name</label>
                    <input
                      type="text"
                      value={editContact.learner_name}
                      onChange={(e) => setEditContact({
                        ...editContact,
                        learner_name: e.target.value
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Grade</label>
                    <input
                      type="text"
                      value={editContact.grade}
                      onChange={(e) => setEditContact({
                        ...editContact,
                        grade: e.target.value.toUpperCase()
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Device ID</label>
                  <input
                    type="text"
                    value={editContact.device_id}
                    onChange={(e) => setEditContact({
                      ...editContact,
                      device_id: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Mother's Name</label>
                      <input
                        type="text"
                        value={editContact.mother_name}
                        onChange={(e) => setEditContact({
                          ...editContact,
                          mother_name: e.target.value
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Mother's Contact</label>
                      <input
                        type="text"
                        value={editContact.mother_contact}
                        onChange={(e) => setEditContact({
                          ...editContact,
                          mother_contact: e.target.value
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Father's Name</label>
                      <input
                        type="text"
                        value={editContact.father_name}
                        onChange={(e) => setEditContact({
                          ...editContact,
                          father_name: e.target.value
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Father's Contact</label>
                      <input
                        type="text"
                        value={editContact.father_contact}
                        onChange={(e) => setEditContact({
                          ...editContact,
                          father_contact: e.target.value
                        })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Primary Contact</label>
                  <select
                    value={editContact.primary_contact}
                    onChange={(e) => setEditContact({
                      ...editContact,
                      primary_contact: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="mother">Mother</option>
                    <option value="father">Father</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditContact(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Add the Delete All Confirmation Dialog */}
      <AlertDialog 
        open={deleteAllDialog.open} 
        onOpenChange={(open) => setDeleteAllDialog({ open, grade: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all contacts for Grade {deleteAllDialog.grade}?
              This will also delete associated device information.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteAll(deleteAllDialog.grade)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete All
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