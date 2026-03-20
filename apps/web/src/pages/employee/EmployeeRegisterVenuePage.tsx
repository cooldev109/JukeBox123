import React, { useState } from 'react';
import { Input, Button } from '@jukebox/ui';
import { api } from '../../lib/api';

export const EmployeeRegisterVenuePage: React.FC = () => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [code, setCode] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !city || !state || !code) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/venues', {
        name,
        city,
        state,
        code,
        ownerEmail: ownerEmail || undefined,
      });
      setSuccess('Venue registered successfully!');
      setName('');
      setCity('');
      setState('');
      setCode('');
      setOwnerEmail('');
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || 'Failed to register venue.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
        Register Venue
      </h2>

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-jb-highlight-pink/10 border border-jb-highlight-pink/30 rounded-lg p-3">
              <p className="text-jb-highlight-pink text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-jb-accent-green/10 border border-jb-accent-green/30 rounded-lg p-3">
              <p className="text-jb-accent-green text-sm">{success}</p>
            </div>
          )}

          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">
              Venue Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bar do Zeca"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-jb-text-secondary text-sm mb-1">
                City *
              </label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Sao Paulo"
              />
            </div>
            <div>
              <label className="block text-jb-text-secondary text-sm mb-1">
                State *
              </label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. SP"
              />
            </div>
          </div>

          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">
              Venue Code *
            </label>
            <Input
              value={code}
              onChange={handleCodeChange}
              placeholder="e.g. BARZECA01"
            />
            <p className="text-jb-text-secondary/60 text-xs mt-1">
              Unique code for the venue (auto-uppercased)
            </p>
          </div>

          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">
              Owner Email
            </label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@email.com"
            />
            <p className="text-jb-text-secondary/60 text-xs mt-1">
              Optional — assign to an existing bar owner by email
            </p>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register Venue'}
          </Button>
        </form>
      </div>
    </div>
  );
};
