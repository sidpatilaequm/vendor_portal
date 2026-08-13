import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Input from '../common/Input';
import Button from '../common/Button';

const SignupForm = ({ inviteToken, isEmailReadOnly, defaultEmail, adminId, onSignupSuccess }) => {
  const { registerRequest, loading } = useAuth();
  const [vendorName, setVendorName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await registerRequest({
      vendorName,
      address,
      contactName,
      designation,
      email,
      phone,
      token: inviteToken
    }, adminId);

    if (result.success) {
      // Clear inputs
      setVendorName('');
      setAddress('');
      setContactName('');
      setDesignation('');
      if (!isEmailReadOnly) {
        setEmail('');
      }
      setPhone('');
      
      if (onSignupSuccess) {
        onSignupSuccess();
      }
    }
  };

  return (
    <div className="form-card card fade-in-slide">
      <div className="form-card-header">
        <h2 className="form-card-title">Become a supplier</h2>
        <p className="form-card-subtitle">Submit a registration request to our procurement team</p>
      </div>
      <div className="form-card-body">
        <form onSubmit={handleSubmit}>
          <Input
            label="Vendor Legal Entity Name"
            id="vendor_name"
            placeholder="e.g. ABC Pvt Ltd"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            required
          />

          <Input
            label="Vendor Address"
            id="address"
            rows={2}
            placeholder="Street, City, State, Pin Code"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />

          <Input
            label="Vendor Contact Name"
            id="contact_name"
            placeholder="Full name of contact person"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
          />

          <Input
            label="Vendor Designation"
            id="designation"
            placeholder="e.g. Sales Manager, Director"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            required
          />

          <div className="row">
            <div className="col-md-6">
              <Input
                label="Vendor Email"
                id="vendor_email"
                type="email"
                placeholder="email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={isEmailReadOnly}
                required
              />
            </div>
            <div className="col-md-6">
              <Input
                label="Vendor Phone Number"
                id="phone"
                type="tel"
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-100">
            Submit Request
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SignupForm;
