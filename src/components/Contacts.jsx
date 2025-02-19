import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { FaDownload, FaUpload, FaUserPlus, FaFileExcel, FaInfoCircle } from 'react-icons/fa'
import { db } from '../config/firebase'
import { collection, getDocs, addDoc, deleteDoc, query, where } from 'firebase/firestore'

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
    <div className="contacts-container">
      <div className="contacts-header">
        <h2>Student Device Management</h2>
        <div className="template-section">
          <button onClick={downloadTemplate} className="template-button">
            <FaFileExcel /> Download Template
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="contacts-actions">
        <div className="import-section">
          <label htmlFor="file-upload" className="custom-file-upload">
            <FaUpload /> Import Students
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        <button onClick={exportContacts} className="export-button">
          <FaDownload /> Export Data
        </button>
      </div>

      <div className="contacts-list">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Grade</th>
              <th>Device ID</th>
              <th>IMEI Number</th>
              <th>Mother's Contact</th>
              <th>Father's Contact</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact, index) => (
              <tr key={index}>
                <td data-label="Student Name">{contact.student_name}</td>
                <td data-label="Grade">{contact.grade}</td>
                <td data-label="Device ID">{contact.device_id}</td>
                <td data-label="IMEI Number">{contact.imei_number}</td>
                <td 
                  data-label="Mother's Contact"
                  className={`parent-cell ${contact.primary_contact === 'mother' ? 'primary' : ''}`}
                >
                  <div className="parent-info">
                    <span className="parent-name">
                      {contact.mother_name}
                      {contact.primary_contact === 'mother' && 
                        <span className="primary-badge">Primary</span>
                      }
                    </span>
                    <span className="parent-phone">{contact.mother_contact}</span>
                  </div>
                  <div className="contact-tooltip">
                    <FaInfoCircle className="info-icon" />
                    <div className="tooltip-content">
                      <p><strong>Name:</strong> {contact.mother_name}</p>
                      <p><strong>Phone:</strong> {contact.mother_contact}</p>
                      <p><strong>Student:</strong> {contact.student_name}</p>
                      <p><strong>Grade:</strong> {contact.grade}</p>
                      {contact.notes && <p><strong>Notes:</strong> {contact.notes}</p>}
                    </div>
                  </div>
                </td>
                <td 
                  data-label="Father's Contact"
                  className={`parent-cell ${contact.primary_contact === 'father' ? 'primary' : ''}`}
                >
                  <div className="parent-info">
                    <span className="parent-name">
                      {contact.father_name}
                      {contact.primary_contact === 'father' && 
                        <span className="primary-badge">Primary</span>
                      }
                    </span>
                    <span className="parent-phone">{contact.father_contact}</span>
                  </div>
                  <div className="contact-tooltip">
                    <FaInfoCircle className="info-icon" />
                    <div className="tooltip-content">
                      <p><strong>Name:</strong> {contact.father_name}</p>
                      <p><strong>Phone:</strong> {contact.father_contact}</p>
                      <p><strong>Student:</strong> {contact.student_name}</p>
                      <p><strong>Grade:</strong> {contact.grade}</p>
                      {contact.notes && <p><strong>Notes:</strong> {contact.notes}</p>}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && <div className="loading-spinner">Loading...</div>}
    </div>
  )
}

export default Contacts 