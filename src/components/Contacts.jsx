import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, FileSpreadsheet, Trash2, AlertCircle } from 'lucide-react'
import { db } from '../config/firebase'
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

function Contacts() {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, contactId: null })

  const SCHOOL_ID = 'st-marys' // This should match your school's ID in Firestore

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
    setIsLoading(true)
    setError(null)
    
    try {
      const batch = writeBatch(db);
      
      for (const row of validatedContacts) {
        // Add to contacts collection
        const contactRef = doc(collection(db, 'schools', SCHOOL_ID, 'contacts'));
        batch.set(contactRef, {
          student_name: row.student_name,
          grade: row.grade,
          device_id: row.device_id,
          imei_number: row.imei_number,
          mother_name: row.mother_name,
          mother_contact: row.mother_contact,
          father_name: row.father_name,
          father_contact: row.father_contact,
          primary_contact: row.primary_contact,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // If device info exists, add to devices collection
        if (row.imei_number && row.device_id) {
          const deviceRef = doc(collection(db, 'schools', SCHOOL_ID, 'devices'));
          batch.set(deviceRef, {
            imei: row.imei_number,
            device_id: row.device_id,
            student_name: row.student_name,
            grade: row.grade,
            status: 'active',
            last_seen: new Date(),
            assigned_to: contactRef.id
          });
        }
      }

      await batch.commit();
      
      // Refresh the contacts list
      await fetchContacts()
      
    } catch (error) {
      setError('Error saving contacts: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Template structure for student contacts
  const templateData = [
    {
      student_name: 'Example Student',
      grade: '11A',
      device_id: 'iPad-001',
      imei_number: '123456789012345',
      mother_name: 'Mother Name',
      mother_contact: '0123456789', // Will appear as 123456789 in Excel
      father_name: 'Father Name',
      father_contact: '0123456789', // Will appear as 123456789 in Excel
      primary_contact: 'mother', // Options: 'mother' or 'father'
      notes: 'Phone numbers should be 10 digits starting with 0. Excel may remove the leading 0, this will be handled automatically on import.'
    }
  ]

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(templateData)
    
    // Add column widths
    const wscols = [
      { wch: 20 }, // student_name
      { wch: 8 },  // grade
      { wch: 15 }, // device_id
      { wch: 20 }, // imei_number
      { wch: 20 }, // mother_name
      { wch: 15 }, // mother_contact
      { wch: 20 }, // father_name
      { wch: 15 }, // father_contact
      { wch: 15 }, // primary_contact
      { wch: 30 }  // notes
    ]
    worksheet['!cols'] = wscols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
    XLSX.writeFile(workbook, 'student_device_template.xlsx')
  }

  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0]
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        // Tell XLSX to treat IMEI as text
        if (worksheet['!ref']) {
          const range = XLSX.utils.decode_range(worksheet['!ref'])
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const imeiCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 3 })] // Assuming IMEI is 4th column
            if (imeiCell) {
              imeiCell.z = '@' // Format as text
              // Ensure IMEI is treated as string
              imeiCell.v = imeiCell.v.toString()
            }
          }
        }
        const contacts = XLSX.utils.sheet_to_json(worksheet)
        
        // Validate contacts...
        const validatedContacts = contacts.map(contact => ({
          ...contact,
          // Ensure IMEI is always string and pad with leading zeros if needed
          imei_number: contact.imei_number ? contact.imei_number.toString().padStart(15, '0') : null
        }))

        await saveContactsToFirestore(validatedContacts)
      }
      
      reader.readAsArrayBuffer(file)
    } catch (error) {
      setError('Error processing file: ' + error.message)
    }
  }

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
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IMEI Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mother's Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Father's Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.student_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.grade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.device_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {contact.imei_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap">
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