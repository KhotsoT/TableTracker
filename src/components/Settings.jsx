import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Settings as SettingsIcon } from 'lucide-react';

function Settings() {
  const [schoolInfo, setSchoolInfo] = useState({
    name: '',
    address: '',
    principalName: '',
    email: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const SCHOOL_ID = 'st-marys';

  useEffect(() => {
    fetchSchoolInfo();
  }, []);

  const fetchSchoolInfo = async () => {
    try {
      setIsLoading(true);
      const schoolRef = doc(db, 'schools', SCHOOL_ID);
      const schoolDoc = await getDoc(schoolRef);
      
      if (schoolDoc.exists()) {
        setSchoolInfo(schoolDoc.data());
      }
    } catch (error) {
      setError('Error fetching school information');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const schoolRef = doc(db, 'schools', SCHOOL_ID);
      await updateDoc(schoolRef, schoolInfo);
      alert('School information updated successfully!');
    } catch (error) {
      setError('Failed to update school information');
      console.error('Error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSchoolInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">School Settings</h1>
        <SettingsIcon className="w-5 h-5 text-gray-500" />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">School Name</label>
              <Input
                name="name"
                value={schoolInfo.name}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Address</label>
              <Input
                name="address"
                value={schoolInfo.address}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Principal Name</label>
              <Input
                name="principalName"
                value={schoolInfo.principalName}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                name="email"
                type="email"
                value={schoolInfo.email}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input
                name="phone"
                value={schoolInfo.phone}
                onChange={handleChange}
                className="mt-1"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default Settings; 