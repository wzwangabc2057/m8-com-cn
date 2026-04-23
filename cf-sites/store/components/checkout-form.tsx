'use client';

import { useState } from 'react';
import { useStoreI18n } from '@/providers/store-i18n-provider';

interface CheckoutFormProps {
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitting: boolean;
}

export function CheckoutForm({ onSubmit, submitting }: CheckoutFormProps) {
  const { messages } = useStoreI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    note: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputStyle = {
    borderColor: 'var(--color-border)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--color-heading)' }}>
        {messages.shippingInfo}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            {messages.name} *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            {messages.phone} *
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border text-sm"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          {messages.email} *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 rounded-xl border text-sm"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          {messages.shippingAddress} *
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 rounded-xl border text-sm"
          style={inputStyle}
          placeholder={messages.detailedAddress}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          {messages.city} *
        </label>
        <input
          type="text"
          name="city"
          value={formData.city}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 rounded-xl border text-sm"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          {messages.note}
        </label>
        <textarea
          name="note"
          value={formData.note}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
          style={inputStyle}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 rounded-xl text-white font-medium text-base transition-opacity disabled:opacity-50"
        style={{ background: 'var(--color-primary)' }}
      >
        {submitting ? messages.submitting : messages.submitOrder}
      </button>
    </form>
  );
}
