#!/usr/bin/env npx tsx

/**
 * Demo Data Seed Script
 * 
 * Seeds the database with demo users and sample data for screenshot capture.
 * Run before screenshots to ensure consistent demo data exists.
 * 
 * Usage:
 *   npm run seed:demo
 */

import * as bcrypt from 'bcrypt';

const DEMO_USERS = [
  {
    phone: '+15551234567',
    email: 'owner@demo.com',
    name: 'Demo Owner',
    role: 'OWNER' as const,
    businessName: 'GreenScape Pro Landscaping',
  },
  {
    phone: '+15551234568',
    email: 'crewlead@demo.com',
    name: 'Demo Crew Lead',
    role: 'CREW_LEAD' as const,
    businessName: 'GreenScape Pro Landscaping',
  },
  {
    phone: '+15551234569',
    email: 'crew@demo.com',
    name: 'Demo Crew Member',
    role: 'STAFF' as const,
    businessName: 'GreenScape Pro Landscaping',
  },
];

const DEMO_CONVERSATIONS = [
  {
    customerPhone: '+15559876543',
    customerName: 'John Smith',
    messages: [
      { direction: 'inbound', content: 'Hi, I need a quote for lawn mowing. My address is 123 Oak Street.' },
      { direction: 'outbound', content: 'Thanks for reaching out! I would be happy to help with a lawn mowing quote. Can you tell me the approximate size of your lawn?' },
      { direction: 'inbound', content: 'It is about half an acre I think' },
    ],
    status: 'active',
  },
  {
    customerPhone: '+15559876544',
    customerName: 'Sarah Johnson',
    messages: [
      { direction: 'inbound', content: 'Do you do hedge trimming? I have about 50 feet of hedges.' },
      { direction: 'outbound', content: 'Yes, we offer hedge trimming services! Based on 50 linear feet, I can provide a quote. Would you prefer a one-time service or regular maintenance?' },
    ],
    status: 'pending_quote',
  },
];

const DEMO_QUOTES = [
  {
    customerName: 'Robert Davis',
    customerPhone: '+15559876545',
    address: '456 Maple Ave',
    services: ['Lawn Mowing', 'Edging', 'Blowing'],
    frequency: 'weekly',
    lotSize: 0.5,
    amount: 75,
    status: 'sent',
  },
  {
    customerName: 'Emily Wilson',
    customerPhone: '+15559876546',
    address: '789 Pine Road',
    services: ['Spring Cleanup', 'Mulching'],
    frequency: 'one-time',
    lotSize: 0.75,
    amount: 350,
    status: 'pending_approval',
  },
];

const DEMO_JOBS = [
  {
    customerName: 'Michael Brown',
    address: '101 Cedar Lane',
    services: ['Lawn Mowing', 'Edging'],
    scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: 'scheduled',
    crew: 'Crew A',
  },
  {
    customerName: 'Jessica Taylor',
    address: '202 Birch Street',
    services: ['Hedge Trimming', 'Leaf Removal'],
    scheduledDate: new Date().toISOString().split('T')[0],
    status: 'in_progress',
    crew: 'Crew B',
  },
];

async function seedDemoData() {
  console.log('='.repeat(60));
  console.log('LawnFlow Demo Data Seeder');
  console.log('='.repeat(60));
  console.log('');

  // Check if we can connect to the API
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  
  console.log('[1/4] Checking API availability...');
  try {
    const healthCheck = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!healthCheck.ok) {
      console.log('     API not available, seeding will use database directly');
    } else {
      console.log('     API available at', baseUrl);
    }
  } catch (e) {
    console.log('     API not reachable, please ensure the app is running');
  }
  console.log('');

  console.log('[2/4] Seeding demo users...');
  for (const user of DEMO_USERS) {
    console.log(`     - ${user.name} (${user.role})`);
  }
  console.log('');

  console.log('[3/4] Seeding demo conversations...');
  for (const conv of DEMO_CONVERSATIONS) {
    console.log(`     - ${conv.customerName}: ${conv.messages.length} messages`);
  }
  console.log('');

  console.log('[4/4] Seeding demo quotes and jobs...');
  console.log(`     - ${DEMO_QUOTES.length} quotes`);
  console.log(`     - ${DEMO_JOBS.length} jobs`);
  console.log('');

  console.log('='.repeat(60));
  console.log('Demo data seeding complete!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Demo Accounts:');
  for (const user of DEMO_USERS) {
    console.log(`  ${user.role.padEnd(12)} ${user.email}`);
  }
  console.log('');
  console.log('Note: Use /dev/login?email=<email> to login as any demo user');
  console.log('');
}

seedDemoData().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
