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
  Home,
  AlertCircle
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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <div className="text-sm text-gray-600">
          Credits: <span className="font-medium">386</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'new' ? "secondary" : "ghost"}
          onClick={() => setActiveTab('new')}
          className="rounded-md px-4"
        >
          New SMS
        </Button>
        <Button
          variant={activeTab === 'inbox' ? "secondary" : "ghost"}
          onClick={() => setActiveTab('inbox')}
          className="rounded-md px-4"
        >
          Inbox
        </Button>
        <Button
          variant={activeTab === 'sent' ? "secondary" : "ghost"}
          onClick={() => setActiveTab('sent')}
          className="rounded-md px-4"
        >
          Sent
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* New Message Form */}
      {activeTab === 'new' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Compose Message</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Grade</label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
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
                <label className="text-sm font-medium text-gray-700">Recipients</label>
                <Select value={selectedContact} onValueChange={setSelectedContact}>
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
              <label className="text-sm font-medium text-gray-700">Message</label>
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
              <Card className="bg-gray-50/50">
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                    <Users className="w-4 h-4" />
                    Recipients ({previewRecipients.length})
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {previewRecipients.slice(0, 6).map((recipient, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded-md text-sm">
                        <span className="font-medium text-gray-900">{recipient.name}</span>
                        <span className="text-gray-500">{recipient.relation}</span>
                      </div>
                    ))}
                    {previewRecipients.length > 6 && (
                      <div className="p-2 bg-white rounded-md text-center text-gray-500 text-sm">
                        +{previewRecipients.length - 6} more
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Button 
              type="submit"
              disabled={isLoading || !message.trim()}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </Card>
      )}

      {/* Sent Messages */}
      {activeTab === 'sent' && (
        <Card className="divide-y divide-gray-100">
          {sentMessages.map((msg) => (
            <div key={msg.id} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div className="space-y-1">
                  <p className="text-sm text-gray-900">{msg.message}</p>
                  <p className="text-xs text-gray-500">
                    Sent to: {msg.totalRecipients} recipients 
                    ({msg.selectedGrade === 'all' ? 'All Grades' : `Grade ${msg.selectedGrade}`})
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(msg.sentAt)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Delivered: {msg.deliveredCount}/{msg.totalRecipients}</span>
                {msg.failedCount > 0 && (
                  <span className="text-red-500">Failed: {msg.failedCount}</span>
                )}
              </div>
            </div>
          ))}
          {sentMessages.length === 0 && (
            <div className="p-8 text-center">
              <Send className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No messages sent yet</p>
            </div>
          )}
        </Card>
      )}

      {/* Inbox Empty State */}
      {activeTab === 'inbox' && (
        <Card className="divide-y divide-gray-100">
          <div className="p-8 text-center">
            <Mail className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No Messages</h3>
            <p className="text-sm text-gray-500">
              Your inbox is currently empty
            </p>
          </div>
        </Card>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

export default Messages; 