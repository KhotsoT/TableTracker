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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [credits, setCredits] = useState(0);
  const [isLoadingSent, setIsLoadingSent] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const ZOOM_CONNECT_KEY = import.meta.env.VITE_ZOOM_CONNECT_KEY;

  useEffect(() => {
    fetchContacts();
    fetchSentMessages();
    fetchCredits();
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
    setIsLoadingSent(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3000/api/sent-messages');
      if (!response.ok) {
        throw new Error(`Failed to fetch sent messages: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch sent messages');
      }

      setSentMessages(data.messages);
    } catch (error) {
      console.error('Error fetching sent messages:', error);
      setError(`Failed to fetch sent messages: ${error.message}`);
    } finally {
      setIsLoadingSent(false);
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
    setShowSuccess(false);
    setIsLoading(true);

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (previewRecipients.length === 0) {
      setError('No recipients selected');
      return;
    }

    try {
      const result = await sendZoomConnectSMS(previewRecipients, message);
      console.log('SMS sent successfully:', result);
      
      // Refresh credits after sending messages
      await fetchCredits();
      
      setShowSuccess(true);
      setMessage('');
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);

    } catch (error) {
      console.error('Failed to send SMS:', error);
      setError(error.message);
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
      // Format all recipients for sending
      const messages = recipients.map(recipient => {
        // Clean and format the phone number
        let number = recipient.number.replace(/\s+/g, ''); // Remove spaces
        
        // If number starts with '27', replace with '0'
        if (number.startsWith('27')) {
          number = '0' + number.slice(2);
        }
        
        // If number starts with '+27', replace with '0'
        if (number.startsWith('+27')) {
          number = '0' + number.slice(3);
        }
        
        // Ensure number starts with '0'
        if (!number.startsWith('0')) {
          number = '0' + number;
        }
        
        // Convert to international format (27)
        if (number.startsWith('0')) {
          number = '27' + number.slice(1);
        }
        
        // Validate the final number format
        if (!/^27\d{9}$/.test(number)) {
          throw new Error(`Invalid phone number format for ${recipient.name}: ${number}`);
        }

        return {
          recipientNumber: number,
          message: messageText  // Changed to 'message' instead of 'content'
        };
      });

      console.log('Sending messages to:', messages.length, 'recipients');
      
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

      return data;
    } catch (error) {
      console.error('Error sending messages:', error);
      throw error;
    }
  };

  const fetchInboxMessages = async () => {
    setIsLoadingInbox(true);
    setError(null);
    try {
      console.log('Fetching inbox messages...');
      const response = await fetch('http://localhost:3000/api/get-messages');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch inbox messages: ${response.status}`);
      }

      const data = await response.json();
      console.log('Inbox messages response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch inbox messages');
      }

      setInboxMessages(data.messages);
    } catch (error) {
      console.error('Error fetching inbox:', error);
      setError(`Failed to fetch inbox messages: ${error.message}`);
    } finally {
      setIsLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inbox') {
      fetchInboxMessages();
    }
  }, [activeTab]);

  const fetchCredits = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3000/api/balance');
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Credits response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch balance');
      }
      
      setCredits(data.balance || 0);
    } catch (error) {
      console.error('Error fetching credits:', error);
      setError('Failed to fetch SMS credits');
    }
  };

  useEffect(() => {
    if (activeTab === 'sent') {
      fetchSentMessages();
    }
  }, [activeTab]);

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
          Credits: <span className="font-medium">{credits}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg mb-6 w-fit">
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
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 mb-6">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {showSuccess && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-700 flex items-center gap-2">
          <FaCheck className="w-5 h-5" />
          <span>Messages sent successfully to {previewRecipients.length} recipients!</span>
        </div>
      )}

      {activeTab === 'new' && (
        <Card className="p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-8">Compose Message</h2>
          <form onSubmit={handleSubmit}>
            {/* Top section with dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="text-sm font-medium mb-2 block">Grade</label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-full bg-[#646cff] text-white border-[#535bf2] hover:bg-[#535bf2] focus:ring-0">
                    <SelectValue placeholder="Select Grade" />
                  </SelectTrigger>
                  <SelectContent>
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
                <label className="text-sm font-medium mb-2 block">Send To</label>
                <Select value={selectedContact} onValueChange={setSelectedContact}>
                  <SelectTrigger className="w-full bg-[#646cff] text-white border-[#535bf2] hover:bg-[#535bf2] focus:ring-0">
                    <SelectValue placeholder="Select Recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="both">Both Parents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Main content area - split into two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left column - Message input */}
              <div className="space-y-4">
                <label className="text-sm font-medium block">Message</label>
                <Textarea
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="Type your message here..."
                  className="min-h-[240px] resize-y"
                />
                <div className="text-sm text-gray-500">
                  <span className="text-blue-600">{message.length}</span> characters • 
                  <span className="text-blue-600">{Math.ceil(message.length / 160)}</span> SMS segments
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !message.trim() || previewRecipients.length === 0}
                  className="w-full bg-[#646cff] hover:bg-[#535bf2] text-white mt-6"
                >
                  {isLoading ? (
                    <>
                      <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>

              {/* Right column - Recipients preview */}
              {previewRecipients.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-5 h-5 text-gray-500" />
                    <span className="font-medium">Recipients (<span className="text-blue-600">{previewRecipients.length}</span>)</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-600 mb-4">
                    <FaGraduationCap className="w-4 h-4" />
                    <span>
                      {selectedGrade === 'all' ? 'All Grades' : `Grade ${selectedGrade}`} • 
                      {selectedContact === 'both' ? ' Both Parents' : ' Primary Contacts'}
                    </span>
                  </div>

                  <div className="max-h-[240px] overflow-y-auto border rounded-lg bg-white">
                    {previewRecipients.map((recipient, index) => (
                      <div key={index} 
                        className="text-sm flex justify-between p-3 border-b last:border-b-0 hover:bg-gray-50"
                      >
                        <span>{recipient.name}</span>
                        <span className="text-blue-600 font-medium">{recipient.number}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-sm text-gray-600 flex items-center justify-between">
                    <span>Total recipients: <span className="text-blue-600 font-medium">{previewRecipients.length}</span></span>
                    <span>•</span>
                    {estimatedCredits > 0 && (
                      <span>Estimated credits: <span className="text-blue-600 font-medium">{estimatedCredits}</span></span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'inbox' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">Message Inbox</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchInboxMessages}
                disabled={isLoadingInbox}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingInbox ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            
            {isLoadingInbox ? (
              <div className="flex items-center justify-center py-8">
                <FaSpinner className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : inboxMessages.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {inboxMessages.map((msg, index) => (
                  <div key={msg.messageId || index} className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          From: {msg.sender}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          msg.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {msg.status}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(msg.receivedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{msg.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-medium text-gray-900 mb-1">No Messages</h3>
                <p className="text-sm text-gray-500">
                  Your inbox is currently empty
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'sent' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Sent Messages</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSentMessages}
                disabled={isLoadingSent}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingSent ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSent ? (
              <div className="flex items-center justify-center py-8">
                <FaSpinner className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : sentMessages.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {sentMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className="py-4 hover:bg-gray-50 cursor-pointer transition-colors px-4" 
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {msg.totalRecipients} recipient{msg.totalRecipients !== 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-1">
                          {msg.status.delivered > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-full">
                              {msg.status.delivered} delivered
                            </span>
                          )}
                          {msg.status.failed > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded-full">
                              {msg.status.failed} failed
                            </span>
                          )}
                          {msg.status.pending > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-50 text-yellow-700 rounded-full">
                              {msg.status.pending} pending
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(msg.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{msg.message}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      Credits used: {msg.totalCredits}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Send className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-medium text-gray-900 mb-1">No Messages</h3>
                <p className="text-sm text-gray-500">
                  You haven't sent any messages yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedMessage && (
        <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl">Message Details</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-500">Message</label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-500">
                  Recipients ({selectedMessage.totalRecipients})
                </label>
                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto rounded-lg border border-gray-200">
                  {selectedMessage.recipients.map((recipient, index) => (
                    <div key={index} className="p-3 bg-white hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900">{recipient.number}</span>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          recipient.status === 'delivered' ? 'bg-green-100 text-green-800 border border-green-200' :
                          recipient.status === 'failed' ? 'bg-red-100 text-red-800 border border-red-200' :
                          'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        }`}>
                          {recipient.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Sent At</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-900">
                    {new Date(selectedMessage.sentAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Credits</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-900">
                    {selectedMessage.totalCredits}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default Messages; 