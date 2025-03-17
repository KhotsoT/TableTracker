import { useState, useEffect } from 'react';
import { db, SCHOOL_ID } from '../config/firebase';
import API_BASE_URL from '../config/api';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { toast } from "./ui/use-toast";
import { cn } from "../lib/utils";
import { X } from "lucide-react";
import { DialogPrimitive } from "@/components/ui/dialog";

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
  const [replyTo, setReplyTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sentMessagesPage, setSentMessagesPage] = useState(1);
  const [hasMoreSentMessages, setHasMoreSentMessages] = useState(true);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [inboxCacheStatus, setInboxCacheStatus] = useState(null);
  const [hasMoreInboxMessages, setHasMoreInboxMessages] = useState(true);
  const [inboxPage, setInboxPage] = useState(1);
  const MESSAGES_PER_PAGE = 10;

  const ZOOM_CONNECT_KEY = import.meta.env.VITE_ZOOM_CONNECT_KEY;

  // Add new state variables for cache handling
  const [isCacheLoading, setIsCacheLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState(null);

  // Add inbox cache initialization
  const initializeInboxCache = async () => {
    try {
      setIsLoadingInbox(true);
      setError(null);
      
      // Start background fetch
      const response = await fetch(`${API_BASE_URL}/messages/inbox-background-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize inbox cache: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Start polling for cache status
        pollInboxCacheStatus();
      } else {
        throw new Error(data.error || 'Failed to initialize inbox cache');
      }
    } catch (error) {
      console.error('Error initializing inbox cache:', error);
      setError('Failed to load inbox messages. Please try again.');
      // Fallback to direct fetch without cache
      fetchInboxMessages(1);
    } finally {
      setIsLoadingInbox(false);
    }
  };

  // Update polling function with better error handling
  const pollInboxCacheStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/inbox-cache-status`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check cache status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setInboxCacheStatus(data);
        
        // If still updating, poll again in 5 seconds
        if (data.isUpdating) {
          setTimeout(pollInboxCacheStatus, 5000);
        } else {
          // Cache is ready, fetch messages
          fetchInboxMessages(1);
        }
      } else {
        throw new Error(data.error || 'Failed to check cache status');
      }
    } catch (error) {
      console.error('Error polling inbox cache status:', error);
      // On error, try direct fetch
      fetchInboxMessages(1);
    }
  };

  // Update fetchInboxMessages function to match sent messages behavior
  const fetchInboxMessages = async (page = 1) => {
    setIsLoadingInbox(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', MESSAGES_PER_PAGE);
      params.append('useCache', 'true');

      const response = await fetch(`${API_BASE_URL}/inbox-messages?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch inbox messages: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch inbox messages');
      }

      // If it's the first page, replace messages
      // Otherwise append to existing messages
      if (page === 1) {
        setInboxMessages(data.messages);
      } else {
        setInboxMessages(prev => [...prev, ...data.messages]);
      }

      // Update pagination state
      setHasMoreInboxMessages(data.pagination?.hasMore || false);
      setInboxPage(page);

      // Update cache status if provided
      if (data.metadata) {
        setInboxCacheStatus(prev => ({
          ...prev,
          lastUpdated: data.metadata.lastFetched,
          fromCache: data.metadata.fromCache
        }));
      }
    } catch (error) {
      console.error('Error fetching inbox messages:', error);
      setError(error.message);
    } finally {
      setIsLoadingInbox(false);
    }
  };

  // Update refreshInboxMessages function to match sent messages behavior
  const refreshInboxMessages = async () => {
    try {
      setIsLoadingInbox(true);
      
      // First, start a new background fetch
      await fetch(`${API_BASE_URL}/messages/inbox-background-fetch`, {
        method: 'POST'
      });
      
      // Then fetch messages without cache
      const params = new URLSearchParams();
      params.append('page', 1);
      params.append('limit', MESSAGES_PER_PAGE);
      params.append('useCache', 'false');
      
      const response = await fetch(`${API_BASE_URL}/inbox-messages?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setInboxMessages(data.messages);
        setHasMoreInboxMessages(data.pagination?.hasMore || false);
        setInboxPage(1);
        
        // Start polling cache status again
        pollInboxCacheStatus();
        
        toast({
          title: "Messages Refreshed",
          description: "Successfully fetched latest messages from server.",
        });
      }
    } catch (error) {
      console.error('Error refreshing inbox messages:', error);
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingInbox(false);
    }
  };

  // Update useEffect for inbox tab to match sent messages behavior
  useEffect(() => {
    if (activeTab === 'inbox') {
      // Only initialize cache and fetch messages if we don't have any
      if (inboxMessages.length === 0) {
        initializeInboxCache();
      }
    }
  }, [activeTab]);

  useEffect(() => {
    initializeCache();
    fetchContacts();
    fetchCredits();
  }, []);

  // Add cache initialization function
  const initializeCache = async () => {
    try {
      // Start background fetch
      const response = await fetch(`${API_BASE_URL}/messages/background-fetch`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Start polling for cache status
        pollCacheStatus();
      }
    } catch (error) {
      console.error('Error initializing cache:', error);
    }
  };

  // Add cache status polling function
  const pollCacheStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/cache-status`);
      const data = await response.json();
      
      if (data.success) {
        setCacheStatus(data);
        
        // If still updating, poll again in 5 seconds
        if (data.isUpdating) {
          setTimeout(pollCacheStatus, 5000);
        } else {
          // Cache is ready, fetch messages
          fetchSentMessages(1, dateFilter);
        }
      }
    } catch (error) {
      console.error('Error polling cache status:', error);
    }
  };

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

  const fetchSentMessages = async (page = 1, dateRange = null) => {
    setIsLoadingSent(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', MESSAGES_PER_PAGE);
      params.append('useCache', 'true'); // Enable cache by default
      
      if (dateRange?.startDate) {
        params.append('afterDate', dateRange.startDate);
      }
      
      if (dateRange?.endDate) {
        params.append('beforeDate', dateRange.endDate);
      }
      
      console.log('Fetching sent messages with params:', params.toString());
      
      const response = await fetch(`${API_BASE_URL}/sent-messages?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sent messages: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch sent messages');
      }

      // If it's the first page or we're filtering, replace the messages
      // Otherwise append to existing messages
      if (page === 1 || dateRange) {
        setSentMessages(data.messages);
      } else {
        setSentMessages(prev => [...prev, ...data.messages]);
      }
      
      // Check if there are more messages to load
      setHasMoreSentMessages(data.pagination.hasMore);
      setSentMessagesPage(page);

      // Update cache status if provided
      if (data.metadata) {
        setCacheStatus(prev => ({
          ...prev,
          lastUpdated: data.metadata.lastFetched,
          fromCache: data.metadata.fromCache
        }));
      }
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

    console.log('Filtering contacts for grade:', selectedGrade);
    console.log('Contact grades sample:', contacts.slice(0, 3).map(c => ({ 
      grade: c.grade, 
      gradeType: typeof c.grade 
    })));

    const filtered = contacts.filter(contact => {
      if (!contact.grade) return false;
      
      // For "all" grade, include all contacts with a valid grade
      if (selectedGrade === 'all') return true;
      
      // Convert both to strings for comparison and trim any whitespace
      const contactGrade = String(contact.grade).trim();
      const selectedGradeStr = String(selectedGrade).trim();
      
      return contactGrade === selectedGradeStr;
    });

    console.log('Filtered contacts count:', filtered.length);

    const recipients = filtered.flatMap(contact => {
      const recipients = [];
      
      if (selectedContact === 'both' || 
         (selectedContact === 'primary' && contact.primary_contact === 'mother')) {
        if (contact.mother_contact && contact.mother_contact !== 'N/A') {
          recipients.push({
            name: contact.learner_name,
            number: contact.mother_contact,
            relation: 'Mother',
            grade: contact.grade
          });
        }
      }
      
      if (selectedContact === 'both' || 
         (selectedContact === 'primary' && contact.primary_contact === 'father')) {
        if (contact.father_contact && contact.father_contact !== 'N/A') {
          recipients.push({
            name: contact.learner_name,
            number: contact.father_contact,
            relation: 'Father',
            grade: contact.grade
          });
        }
      }
      
      return recipients;
    });

    console.log('Total recipients after filtering:', recipients.length);
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
      
      // Create alert document for the sent SMS
      const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts');
      await addDoc(alertsRef, {
        type: 'sms',
        message: message,
        recipients_count: previewRecipients.length,
        createdAt: new Date(),
        status: 'sent'
      });
      
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
      // Log the number of recipients for debugging
      console.log(`Preparing to send SMS to ${recipients.length} recipients`);
      
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
          console.warn(`Invalid phone number format for ${recipient.name}: ${number}`);
          return null;
        }

        return {
          recipientNumber: number,
          message: messageText
        };
      }).filter(Boolean); // Remove any null entries from invalid numbers

      console.log('Sending messages to:', messages.length, 'recipients');
      
      // If we have a large number of recipients, send in batches
      const BATCH_SIZE = 50; // Adjust based on server capacity
      let allResults = [];
      
      // Process in batches if more than BATCH_SIZE recipients
      if (messages.length > BATCH_SIZE) {
        console.log(`Sending in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          const batch = messages.slice(i, i + BATCH_SIZE);
          console.log(`Sending batch ${i/BATCH_SIZE + 1} of ${Math.ceil(messages.length/BATCH_SIZE)}, size: ${batch.length}`);
          
          const response = await fetch(`${API_BASE_URL}/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages: batch })
          });
          
          const data = await response.json();
          console.log(`Batch ${i/BATCH_SIZE + 1} response:`, data);
          
          if (!data.success) {
            throw new Error(data.error || `Failed to send batch ${i/BATCH_SIZE + 1}`);
          }
          
          allResults.push(data);
        }
        
        return {
          success: true,
          batches: allResults.length,
          totalSent: messages.length
        };
      } else {
        // Send all messages in one request if fewer than BATCH_SIZE
        const response = await fetch(`${API_BASE_URL}/send-sms`, {
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
      }
    } catch (error) {
      console.error('Error sending messages:', error);
      throw error;
    }
  };

  const fetchCredits = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/balance`);
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
      fetchSentMessages(1);
    }
  }, [activeTab]);

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

  const handleResendFailed = async (message) => {
    try {
      // Get failed recipients
      const failedRecipients = message.recipients.filter(r => r.status === 'failed');
      
      if (failedRecipients.length === 0) {
        console.log('No failed recipients to resend to');
        toast({
          title: "No Failed Messages",
          description: "There are no failed messages to resend",
          variant: "info"
        });
        return;
      }
      
      console.log(`Resending to ${failedRecipients.length} failed recipients`);
      
      // If we have a large number of recipients, send in batches
      const BATCH_SIZE = 50;
      let allResults = [];
      
      // Process in batches if more than BATCH_SIZE recipients
      if (failedRecipients.length > BATCH_SIZE) {
        console.log(`Resending in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < failedRecipients.length; i += BATCH_SIZE) {
          const batch = failedRecipients.slice(i, i + BATCH_SIZE);
          console.log(`Resending batch ${i/BATCH_SIZE + 1} of ${Math.ceil(failedRecipients.length/BATCH_SIZE)}, size: ${batch.length}`);
          
          const response = await fetch(`${API_BASE_URL}/resend-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: message.message,
              recipients: batch.map(r => r.number)
            })
          });
          
          const data = await response.json();
          console.log(`Batch ${i/BATCH_SIZE + 1} response:`, data);
          
          if (!data.success) {
            throw new Error(data.error || `Failed to resend batch ${i/BATCH_SIZE + 1}`);
          }
          
          allResults.push(data);
        }
        
        toast({
          title: "Messages Queued",
          description: `Resending to ${failedRecipients.length} failed recipient(s) in ${allResults.length} batches`,
          variant: "success"
        });
      } else {
        // Send all in one request if fewer than BATCH_SIZE
        const response = await fetch(`${API_BASE_URL}/resend-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message.message,
            recipients: failedRecipients.map(r => r.number)
          })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        toast({
          title: "Messages Queued",
          description: `Resending to ${failedRecipients.length} failed recipient(s)`,
          variant: "success"
        });
      }

      // Refresh messages list
      fetchSentMessages(sentMessagesPage, dateFilter);
      
    } catch (error) {
      console.error('Error resending messages:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSendReply = async (recipients) => {
    try {
      const response = await fetch(`${API_BASE_URL}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: replyMessage,
          recipients: recipients.map(r => r.number)
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Message Sent",
        description: `Message sent to ${recipients.length} recipient(s)`,
        variant: "success"
      });

      setReplyTo(null);
      setReplyMessage('');
      fetchSentMessages(sentMessagesPage, dateFilter); // Refresh the list
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleLoadMoreMessages = () => {
    fetchSentMessages(sentMessagesPage + 1, dateFilter.startDate ? dateFilter : null);
  };

  const handleDateFilterSubmit = (e) => {
    e.preventDefault();
    fetchSentMessages(1, dateFilter);
  };

  const handleDateFilterReset = () => {
    setDateFilter({ startDate: '', endDate: '' });
    fetchSentMessages(1);
    setShowDateFilter(false);
  };

  // Add refresh function to force fetch from API
  const refreshSentMessages = async () => {
    try {
      setIsLoadingSent(true);
      
      // First, start a new background fetch
      await fetch(`${API_BASE_URL}/messages/background-fetch`, {
        method: 'POST'
      });
      
      // Then fetch messages without cache
      const params = new URLSearchParams();
      params.append('page', 1);
      params.append('limit', MESSAGES_PER_PAGE);
      params.append('useCache', 'false');
      
      const response = await fetch(`${API_BASE_URL}/sent-messages?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setSentMessages(data.messages);
        setHasMoreSentMessages(data.pagination.hasMore);
        setSentMessagesPage(1);
        
        // Start polling cache status again
        pollCacheStatus();
        
        toast({
          title: "Messages Refreshed",
          description: "Successfully fetched latest messages from server.",
        });
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingSent(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 p-4 bg-white rounded-lg shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Messages</h1>
          <div className="flex items-center gap-2 ml-8">
            <span className="text-gray-600">Available Credits:</span>
            <span className="text-xl font-bold text-blue-600">{credits}</span>
          </div>
        </div>
        <Button
          onClick={fetchCredits}
          variant="outline"
          size="sm"
          className="text-gray-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Credits
        </Button>
      </div>

      <Tabs defaultValue="new" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new">
            <MessageSquare className="w-4 h-4 mr-2" />
            New Message
          </TabsTrigger>
          <TabsTrigger value="inbox">
            <Inbox className="w-4 h-4 mr-2" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="w-4 h-4 mr-2" />
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
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
                          className="text-sm flex justify-between items-center p-3 border-b last:border-b-0 hover:bg-gray-50"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{recipient.name}</span>
                            <span className="text-gray-500 text-xs">Grade {recipient.grade} • {recipient.relation}</span>
                          </div>
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
        </TabsContent>

        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Message Inbox</CardTitle>
                <div className="flex items-center gap-4">
                  {inboxCacheStatus?.isUpdating && (
                    <div className="flex items-center text-sm text-yellow-600">
                      <FaSpinner className="animate-spin mr-2" />
                      Updating cache...
                    </div>
                  )}
                  {inboxCacheStatus?.lastUpdated && (
                    <span className="text-sm text-gray-500">
                      Last updated: {new Date(inboxCacheStatus.lastUpdated).toLocaleString()}
                    </span>
                  )}
                  <Button 
                    onClick={refreshInboxMessages}
                    disabled={isLoadingInbox}
                    variant="outline"
                    className="text-gray-700"
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      isLoadingInbox && "animate-spin"
                    )} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
              
              {isLoadingInbox && inboxMessages.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <FaSpinner className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : inboxMessages.length > 0 ? (
                <div className="space-y-4">
                  {inboxMessages.map((msg) => (
                    <Card 
                      key={msg.id || msg.receivedAt} 
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            From: {msg.fromNumber}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            msg.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {msg.status}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(msg.dateTimeReceived).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{msg.message}</p>
                    </Card>
                  ))}

                  {hasMoreInboxMessages && (
                    <div className="flex justify-center mt-4">
                      <Button
                        onClick={() => fetchInboxMessages(inboxPage + 1)}
                        disabled={isLoadingInbox}
                        variant="outline"
                        className="w-40 border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        {isLoadingInbox ? (
                          <>
                            <FaSpinner className="animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          'Load More'
                        )}
                      </Button>
                    </div>
                  )}
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
        </TabsContent>

        <TabsContent value="sent">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Sent Messages</h2>
                <div className="flex items-center gap-4">
                  {cacheStatus?.isUpdating && (
                    <div className="flex items-center text-sm text-yellow-600">
                      <FaSpinner className="animate-spin mr-2" />
                      Updating cache...
                    </div>
                  )}
                  {cacheStatus?.lastUpdated && (
                    <span className="text-sm text-gray-500">
                      Last updated: {new Date(cacheStatus.lastUpdated).toLocaleString()}
                    </span>
                  )}
                  <Button
                    onClick={refreshSentMessages}
                    disabled={isLoadingSent}
                    variant="outline"
                    className="text-gray-700"
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      isLoadingSent && "animate-spin"
                    )} />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              <div className="space-y-4">
                {sentMessages.map((msg, index) => (
                  <div 
                    key={msg.id || index} 
                    className="bg-white border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleMessageClick(msg)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">
                          {msg.message}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sent: {new Date(msg.sentAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                          Recipients: {msg.totalRecipients}
                        </p>
                        <p className="text-sm text-gray-600">
                          Credits: {msg.totalCredits}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <FaCheck className="w-4 h-4 mr-1 text-green-500" />
                        {msg.status.delivered || 0} delivered
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <FaClock className="w-4 h-4 mr-1 text-yellow-500" />
                        {msg.status.pending || 0} pending
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <FaExclamationCircle className="w-4 h-4 mr-1 text-red-500" />
                        {msg.status.failed || 0} failed
                      </div>
                    </div>
                  </div>
                ))}

                {hasMoreSentMessages && (
                  <div className="flex justify-center mt-4">
                    <Button
                      onClick={() => fetchSentMessages(sentMessagesPage + 1)}
                      disabled={isLoadingSent}
                      variant="outline"
                      className="w-40 border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      {isLoadingSent ? (
                        <>
                          <FaSpinner className="animate-spin mr-2" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}

                {sentMessages.length === 0 && !isLoadingSent && (
                  <div className="text-center py-8 text-gray-500">
                    No sent messages found
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {selectedMessage && (
        <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent 
            className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
            aria-describedby="message-details-description"
          >
            <DialogHeader className="border-b pb-4 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <DialogTitle className="text-xl">Message Details</DialogTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Available Credits:</span>
                  <span className="text-lg font-bold text-blue-600">{credits}</span>
                </div>
              </div>
              <DialogDescription id="message-details-description">
                {selectedMessage.sender ? 'Received message details' : 'Sent message details'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 overflow-y-auto">
              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Message</label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                  {selectedMessage.message}
                </div>
              </div>

              {selectedMessage.sender ? (
                // For inbox messages
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">From</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-gray-900">{selectedMessage.sender}</span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        received
                      </span>
                    </div>
                  </div>

                  {/* Reply section for inbox messages */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Reply</label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply here..."
                      className="w-full px-4 py-3 h-32 resize-none border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              ) : (
                // For sent messages
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">
                      Recipients Summary
                    </label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Total Recipients:</span>
                        <span className="font-medium">{selectedMessage.totalRecipients || selectedMessage.recipients?.length || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Delivered:</span>
                        <span className="font-medium text-green-600">{selectedMessage.status?.delivered || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Failed:</span>
                        <span className="font-medium text-red-600">{selectedMessage.status?.failed || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Pending:</span>
                        <span className="font-medium text-yellow-600">{selectedMessage.status?.pending || 0}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 mt-2">
                        <span className="text-sm font-medium text-gray-700">Credits Used:</span>
                        <span className="font-medium text-blue-600">{selectedMessage.totalCredits || Math.ceil(selectedMessage.message.length / 160)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedMessage.recipients?.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">
                        Recipients Detail {selectedMessage.recipients.length > 20 && `(Showing first 20 of ${selectedMessage.recipients.length})`}
                      </label>
                      <div className="bg-gray-50 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                        {selectedMessage.recipients.slice(0, 20).map((recipient, index) => (
                          <div key={index} className="px-4 py-3 flex items-center justify-between">
                            <span className="text-sm text-gray-900">{recipient.number}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              recipient.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              recipient.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {recipient.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Sent At</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                      {new Date(selectedMessage.sentAt).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-auto shrink-0">
              {selectedMessage.sender ? (
                // Buttons for inbox messages
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedMessage(null)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      handleSendReply([{ number: selectedMessage.sender }]);
                      setSelectedMessage(null);
                    }}
                    disabled={!replyMessage.trim()}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Send Reply
                  </Button>
                </>
              ) : (
                // Buttons for sent messages
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedMessage(null)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </Button>
                  {(selectedMessage.status?.failed > 0) && (
                    <Button
                      onClick={() => {
                        handleResendFailed(selectedMessage);
                        setSelectedMessage(null);
                      }}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Resend Failed
                    </Button>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {replyTo && (
        <Dialog open={!!replyTo} onOpenChange={() => setReplyTo(null)}>
          <DialogContent 
            className="sm:max-w-[600px]"
            aria-describedby="reply-message-description"
          >
            <DialogHeader>
              <DialogTitle>Reply to Message</DialogTitle>
              <DialogDescription id="reply-message-description">
                Send a reply to this message
              </DialogDescription>
            </DialogHeader>
            {/* Rest of the content... */}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default Messages; 