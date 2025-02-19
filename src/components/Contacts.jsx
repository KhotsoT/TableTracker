import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, FileSpreadsheet, Info } from 'lucide-react'
import { db } from '../config/firebase'
import { collection, getDocs, addDoc, deleteDoc, query, where } from 'firebase/firestore'
import { Card } from './ui/card'
import { Button } from './ui/button'

function Contacts() {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

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
      // Reference to the contacts subcollection
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts')

      // First, delete existing contacts
      const existingContacts = await getDocs(contactsRef)
      const deletePromises = existingContacts.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      // Then add new contacts
      const addPromises = validatedContacts.map(contact => {
        return addDoc(contactsRef, {
          ...contact,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      })

      await Promise.all(addPromises)
      
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    setError(null)

    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        // Validate the data
        const isValid = validateImportData(data)
        if (isValid) {
          await saveContactsToFirestore(data)
        }
      } catch (error) {
        setError('Error processing file: ' + error.message)
      }
    }

    reader.onerror = () => {
      setError('Error reading file')
    }

    reader.readAsBinaryString(file)
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

    // Remove Firestore-specific fields before export
    const exportData = contacts.map(({ id, createdAt, updatedAt, ...contact }) => contact)

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')
    XLSX.writeFile(workbook, 'student_devices.xlsx')
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Student Device Management</h1>
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="flex items-center gap-2"
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
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label 
              htmlFor="file-upload" 
              className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-gray-600">Import Students</span>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <Button 
            variant="outline"
            onClick={exportContacts}
            className="flex items-center gap-2"
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
                      <button className="text-gray-400 hover:text-gray-600">
                        <Info className="w-4 h-4" />
                      </button>
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
                      <button className="text-gray-400 hover:text-gray-600">
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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