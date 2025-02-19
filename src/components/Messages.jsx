import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, query, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { FaPaperPlane, FaUserFriends, FaSpinner, FaHistory, FaCheck, FaClock, FaExclamationCircle, FaUsers, FaGraduationCap, FaInbox, FaEnvelope, FaHome, FaQuestionCircle, FaPlus } from 'react-icons/fa';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  MessageSquare,
  Send,
  Users,
  Mail,
  Inbox,
  Calendar,
  Settings,
  LogOut,
  RefreshCw,
  Plus,
  Home
} from 'lucide-react';

function Messages() {
  const [contacts, setContacts] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedContact, setSelectedContact] = useState('primary');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewRecipients, setPreviewRecipients] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('new');  // 'new', 'inbox', or 'sent'

  const SCHOOL_ID = 'st-marys';

  const ZOOM_CONNECT_KEY = import.meta.env.VITE_ZOOM_CONNECT_KEY;

  useEffect(() => {
    fetchContacts();
    fetchSentMessages();
  }, []);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts');
      const querySnapshot = await getDocs(contactsRef);
      const contactsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContacts(contactsList);
    } catch (error) {
      setError('Error fetching contacts: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSentMessages = async () => {
    try {
      const messagesRef = collection(db, 'schools', SCHOOL_ID, 'messages');
      const q = query(messagesRef, orderBy('sentAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const messagesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSentMessages(messagesList);
    } catch (error) {
      setError('Error fetching message history: ' + error.message);
    }
  };

  // Get unique grades from contacts
  const grades = ['all', ...new Set(contacts.map(contact => contact.grade))].sort();

  // Filter recipients based on selections
  useEffect(() => {
    const filtered = contacts.filter(contact => {
      const gradeMatch = selectedGrade === 'all' || contact.grade === selectedGrade;
      const contactMatch = selectedContact === 'primary' ? 
        true : // When sending to primary contacts only
        selectedContact === 'both'; // When sending to both parents
      return gradeMatch && contactMatch;
    });

    const recipients = filtered.flatMap(contact => {
      if (selectedContact === 'primary') {
        // Only include primary contact
        const primaryNumber = contact.primary_contact === 'mother' ? 
          contact.mother_contact : contact.father_contact;
        return [{
          name: contact.student_name,
          number: primaryNumber,
          relation: contact.primary_contact
        }];
      } else {
        // Include both parents
        return [
          {
            name: contact.student_name,
            number: contact.mother_contact,
            relation: 'mother'
          },
          {
            name: contact.student_name,
            number: contact.father_contact,
            relation: 'father'
          }
        ];
      }
    });

    setPreviewRecipients(recipients);
  }, [contacts, selectedGrade, selectedContact]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (previewRecipients.length === 0) {
      setError('No recipients selected');
      return;
    }

    setIsLoading(true);
    try {
      // Create message record in Firestore
      const messagesRef = collection(db, 'schools', SCHOOL_ID, 'messages');
      const messageDocRef = await addDoc(messagesRef, {
        message: message.trim(),
        recipients: previewRecipients,
        sentAt: new Date(),
        status: 'sending',
        selectedGrade: selectedGrade,
        selectedContact: selectedContact,
        totalRecipients: previewRecipients.length,
        deliveredCount: 0,
        failedCount: 0
      });

      // Send messages using Zoom Connect
      const result = await sendZoomConnectSMS(previewRecipients, message.trim());

      // Update message status using updateDoc
      await updateDoc(messageDocRef, {
        status: 'delivered',
        deliveredCount: previewRecipients.length,
        updatedAt: new Date()
      });

      setMessage('');
      setShowHistory(true);
      await fetchSentMessages();

    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <FaCheck className="status-icon delivered" />;
      case 'pending':
        return <FaClock className="status-icon pending" />;
      case 'failed':
        return <FaExclamationCircle className="status-icon failed" />;
      default:
        return null;
    }
  };
  const formatDate = (date) => {
    return new Date(date.toDate()).toLocaleString();
  };

  const sendZoomConnectSMS = async (recipients, messageText) => {
    try {
      // Format all recipients for bulk sending
      const messages = recipients.map(recipient => ({
        recipientNumber: recipient.number.replace(/^\+27/, '0'),
        content: messageText
      }));

      console.log('Sending bulk messages to:', messages.length, 'recipients');
      
      const response = await fetch('http://localhost:3000/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
      });

      const data = await response.json();
      console.log('Server response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send SMS');
      }

      return {
        success: true,
        data: {
          status: 'delivered',
          sentCount: messages.length
        }
      };
    } catch (error) {
      console.error('Error sending messages:', error);
      throw error;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header - Simplified */}
      <div className="flex justify-end items-center mb-6">
        <div className="text-sm text-gray-600">
          Credits: <span className="font-medium">386</span>
        </div>
      </div>

      {/* Updated Message Actions */}
      <div className="flex space-x-4 mb-6">
        <Button 
          variant={activeTab === 'new' ? "secondary" : "ghost"}
          onClick={() => setActiveTab('new')}
          className="flex-1"
        >
          <span className="mr-2">New SMS</span>
        </Button>
        <Button 
          variant={activeTab === 'inbox' ? "secondary" : "ghost"}
          onClick={() => setActiveTab('inbox')}
          className="flex-1"
        >
          Inbox
        </Button>
        <Button 
          variant={activeTab === 'sent' ? "secondary" : "ghost"}
          onClick={() => setActiveTab('sent')}
          className="flex-1"
        >
          Sent
        </Button>
      </div>

      {/* Conditional rendering based on active tab */}
      {activeTab === 'new' && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Compose Message</h2>
          </div>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Grade</label>
                  <Select 
                    value={selectedGrade}
                    onValueChange={setSelectedGrade}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map(grade => (
                        <SelectItem key={grade} value={grade}>
                          {grade === 'all' ? 'All Grades' : `Grade ${grade}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Recipients</label>
                  <Select 
                    value={selectedContact}
                    onValueChange={setSelectedContact}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary Contact Only</SelectItem>
                      <SelectItem value="both">Both Parents</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  className="resize-none"
                />
                <div className="text-sm text-gray-500 text-right">
                  {message.length}/160 characters
                </div>
              </div>

              {previewRecipients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      Recipients ({previewRecipients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    {previewRecipients.slice(0, 6).map((recipient, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <span className="font-medium">{recipient.name}</span>
                        <span className="text-sm text-gray-500">{recipient.relation}</span>
                      </div>
                    ))}
                    {previewRecipients.length > 6 && (
                      <div className="p-2 bg-gray-50 rounded-md text-center text-gray-500">
                        +{previewRecipients.length - 6} more
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex space-x-4">
                <Button 
                  type="submit"
                  disabled={isLoading || !message.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      
      {activeTab === 'inbox' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Inbox</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Messages</h3>
            <p className="text-sm text-gray-500">
              Your inbox is currently empty
            </p>
          </div>
        </Card>
      )}
      
      {activeTab === 'sent' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Sent Messages</h2>
          <div className="space-y-4">
            {sentMessages.length > 0 ? (
              sentMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-gray-900">{msg.message}</p>
                      <p className="text-sm text-gray-500">
                        Sent to: {msg.totalRecipients} recipients 
                        ({msg.selectedGrade === 'all' ? 'All Grades' : `Grade ${msg.selectedGrade}`})
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(msg.status)}
                      <span className="text-xs text-gray-500">
                        {formatDate(msg.sentAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>
                      Delivered: {msg.deliveredCount}/{msg.totalRecipients}
                    </span>
                    {msg.failedCount > 0 && (
                      <span className="text-red-500">
                        • Failed: {msg.failedCount}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Send className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Messages Sent</h3>
                <p className="text-sm text-gray-500">
                  You haven't sent any messages yet
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export default Messages; 