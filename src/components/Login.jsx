import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tablet, ArrowRight, MessageSquare, Users } from 'lucide-react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex md:flex-row">
      {/* Left Panel - Hero Section */}
      <div className="hidden md:flex md:w-1/2 bg-blue-600 text-white p-8 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Tablet className="w-8 h-8" />
            <span className="text-2xl font-bold">SchoolConnect</span>
          </div>
          <div className="mt-16 max-w-lg">
            <h1 className="text-4xl font-bold mb-6">
              Stay connected with your school community
            </h1>
            <p className="text-blue-100 text-lg">
              Send bulk SMS messages to parents and manage all communications from one central platform.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 mt-1 text-blue-300" />
                <p className="text-blue-100">Instant SMS messaging to parents and guardians</p>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 mt-1 text-blue-300" />
                <p className="text-blue-100">Manage contact groups by grade or class</p>
              </div>
              {/* Temporarily hidden tracking feature
              <div className="flex items-start gap-3">
                <Tablet className="w-5 h-5 mt-1 text-blue-300" />
                <p className="text-blue-100">Monitor school device locations and status</p>
              </div>
              */}
            </div>
          </div>
        </div>
        <div className="text-blue-100 text-sm">
          © 2024 SchoolConnect. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <Card className="w-full max-w-[440px] p-8 shadow-none md:shadow-xl">
          {/* Mobile Logo - Only visible on mobile */}
          <div className="flex items-center gap-3 mb-8 md:hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Tablet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">SchoolConnect</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
            <p className="mt-2 text-gray-600">
              Access your school communication dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11"
                placeholder="admin@school.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11"
                placeholder="Enter your password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                'Signing in...'
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-gray-500 mt-6">
              This is a secure system. Unauthorized access is prohibited.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default Login; 