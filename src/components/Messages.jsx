import { useState, useEffect } from 'react';
import { db, SCHOOL_ID } from '../config/firebase';
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
  const [estimatedCredits, setEstimatedCredits] = useState(0);
  const [grades, setGrades] = useState(['all']);

  const ZOOM_CONNECT_KEY = import.meta.env.VITE_ZOOM_CONNECT_KEY;

  useEffect(() => {
    fetchContacts();
    fetchSentMessages();
  }, []);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching contacts for school:', SCHOOL_ID);
      
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts');
      const querySnapshot = await getDocs(contactsRef);
      
      if (querySnapshot.empty) {
        console.log('No contacts found in Firebase');
        setContacts([]);
        return;
      }
      
      const contactsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Fetched contacts:', contactsList);
      console.log('Contact grades:', contactsList.map(c => c.grade));
      
      setContacts(contactsList);

      // Extract grades immediately after setting contacts
      const uniqueGrades = [...new Set(contactsList.map(contact => 
        contact.grade?.toString().trim()
      ))].filter(Boolean);
      
      const sortedGrades = uniqueGrades.sort((a, b) => {
        const gradeA = a.replace(/[^0-9]/g, '');
        const gradeB = b.replace(/[^0-9]/g, '');
        return parseInt(gradeA) - parseInt(gradeB);
      });
      
      setGrades(['all', ...sortedGrades]);
      console.log('Grades set to:', ['all', ...sortedGrades]);

    } catch (error) {
      console.error('Error fetching contacts:', error);
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

  // Update the recipients filter for better handling
  useEffect(() => {
    if (contacts.length === 0) return;

    const filtered = contacts.filter(contact => {
      if (!contact.grade) return false;
      return selectedGrade === 'all' || contact.grade.toString() === selectedGrade.toString();
    });

    const recipients = filtered.flatMap(contact => {
      const recipients = [];
      
      if (selectedContact === 'both' || 
         (selectedContact === 'primary' && contact.primary_contact === 'mother')) {
        if (contact.mother_contact) {
          recipients.push({
            name: contact.student_name,
            number: contact.mother_contact,
            relation: 'mother',
            grade: contact.grade
          });
        }
      }
      
      if (selectedContact === 'both' || 
         (selectedContact === 'primary' && contact.primary_contact === 'father')) {
        if (contact.father_contact) {
          recipients.push({
            name: contact.student_name,
            number: contact.father_contact,
            relation: 'father',
            grade: contact.grade
          });
        }
      }
      
      return recipients;
    });

    setPreviewRecipients(recipients);
  }, [contacts, selectedGrade, selectedContact]);

  // Update the credit calculation function
  const calculateEstimatedCredits = (messageText, recipientCount) => {
    // No message, no credits
    if (!messageText?.trim()) return 0;
    
    // No recipients, no credits
    if (!recipientCount) return 0;
    
    // Calculate segments needed
    const segmentCount = Math.ceil(messageText.length / 160);
    
    // Total credits = segments × recipients
    return segmentCount * recipientCount;
  };

  // Update the message change handler
  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Calculate credits based on new message
    const credits = calculateEstimatedCredits(newMessage, previewRecipients.length);
    setEstimatedCredits(credits);
  };

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

  // Update the recipients preview section
  const RecipientsList = ({ recipients }) => {
    if (recipients.length === 0) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Recipients ({recipients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Summary line */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <FaGraduationCap className="w-4 h-4" />
              <span>
                {selectedGrade === 'all' ? 'All Grades' : `Grade ${selectedGrade}`} • 
                {selectedContact === 'both' ? ' Both Parents' : ' Primary Contacts'}
              </span>
            </div>

            {/* Simple list of recipients */}
            <div className="max-h-40 overflow-y-auto space-y-1">
              {recipients.map((recipient, index) => (
                <div key={index} className="text-sm flex justify-between">
                  <span>{recipient.name}</span>
                  <span className="text-gray-500">{recipient.number}</span>
                </div>
              ))}
            </div>

            {/* Total count and credits */}
            <div className="pt-3 border-t text-sm text-gray-600 flex items-center justify-between">
              <span>Total recipients: {recipients.length}</span>
              {estimatedCredits > 0 && (
                <span>Estimated credits: {estimatedCredits}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header - Make it stack on mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <div className="text-sm text-gray-600 w-full sm:w-auto">
          Credits: <span className="font-medium">386</span>
        </div>
      </div>

      {/* Tabs - Make them scroll horizontally on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg w-fit min-w-full sm:min-w-0">
          <Button
            variant={activeTab === 'new' ? "secondary" : "ghost"}
            onClick={() => setActiveTab('new')}
            className="rounded-md px-4 flex-1 sm:flex-none whitespace-nowrap"
          >
            New SMS
          </Button>
          <Button
            variant={activeTab === 'inbox' ? "secondary" : "ghost"}
            onClick={() => setActiveTab('inbox')}
            className="rounded-md px-4 flex-1 sm:flex-none whitespace-nowrap"
          >
            Inbox
          </Button>
          <Button
            variant={activeTab === 'sent' ? "secondary" : "ghost"}
            onClick={() => setActiveTab('sent')}
            className="rounded-md px-4 flex-1 sm:flex-none whitespace-nowrap"
          >
            Sent
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* New Message Form - Responsive grid */}
      {activeTab === 'new' && (
        <Card className="p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Compose Message</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Grade and Contact Type Selection - Stack on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Grade</label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger className="w-full bg-[#646cff] text-white border-[#535bf2] hover:bg-[#535bf2] focus:ring-0">
                      <SelectValue placeholder="Select Grade" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[40vh]">
                      {grades.map(grade => (
                        <SelectItem 
                          key={grade} 
                          value={grade}
                          className="cursor-pointer hover:bg-[#646cff] hover:text-white"
                        >
                          {grade === 'all' ? 'All Grades' : `Grade ${grade}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Send To</label>
                  <Select value={selectedContact} onValueChange={setSelectedContact}>
                    <SelectTrigger className="w-full bg-[#646cff] text-white border-[#535bf2] hover:bg-[#535bf2] focus:ring-0">
                      <SelectValue placeholder="Select Recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem 
                        value="primary"
                        className="cursor-pointer hover:bg-[#646cff] hover:text-white"
                      >
                        Primary Contact
                      </SelectItem>
                      <SelectItem 
                        value="both"
                        className="cursor-pointer hover:bg-[#646cff] hover:text-white"
                      >
                        Both Parents
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Recipients List - Scrollable on mobile */}
              <div className="bg-gray-50 rounded-lg p-4 max-h-[40vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Recipients ({previewRecipients.length})</span>
                </div>
                <div className="space-y-2">
                  {previewRecipients.map((recipient, index) => (
                    <div key={index} className="flex justify-between text-sm p-2 bg-white rounded">
                      <span>{recipient.name}</span>
                      <span className="text-gray-500">{recipient.number}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium block">Message</label>
                <Textarea
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="Type your message here..."
                  className="min-h-[100px] w-full"
                />
                <div className="text-sm text-gray-500">
                  {message.length} characters • {Math.ceil(message.length / 160)} SMS segments
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="w-full sm:w-auto"
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