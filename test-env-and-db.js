#!/usr/bin/env node
/**
 * Test script to check environment and MongoDB connectivity
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 ENVIRONMENT & MONGODB CHECK');
console.log('='.repeat(70));

// Check Node environment
console.log('\n1. Node.js Environment:');
console.log('   Node version:', process.version);
console.log('   Working directory:', process.cwd());
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');

// Check .env files
console.log('\n2. Environment Files:');
const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
for (const file of envFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log(`   ✓ ${file} exists (${size} bytes)`);
    
    // Check for MONGODB_URI
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('MONGODB_URI')) {
      const match = content.match(/MONGODB_URI=["']?([^"'\n]+)["']?/);
      if (match) {
        const uri = match[1];
        console.log(`     - Contains MONGODB_URI: ${uri.substring(0, 50)}...`);
        const dbMatch = uri.match(/mongodb.net\/([^?]+)/);
        if (dbMatch) {
          console.log(`     - Database: ${dbMatch[1]}`);
        }
      }
    }
  } else {
    console.log(`   ✗ ${file} not found`);
  }
}

// Test MongoDB connection
console.log('\n3. MongoDB Connection Test:');

async function testMongoDB() {
  try {
    // Manually load .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/MONGODB_URI=["']?([^"'\n]+)["']?/);
      
      if (match) {
        const MONGODB_URI = match[1];
        console.log('   Loading mongoose...');
        const mongoose = require('mongoose');
        
        console.log('   Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        
        console.log('   ✅ Connected successfully!');
        console.log('   Database:', mongoose.connection.db.databaseName);
        console.log('   Host:', mongoose.connection.host);
        console.log('   Ready state:', mongoose.connection.readyState);
        
        // List collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`   Collections: ${collections.length} found`);
        
        // Check specific collections
        const relevantCollections = ['userapikeys', 'batchinferencetasks', 'useraccounts'];
        for (const collName of relevantCollections) {
          const exists = collections.find(c => c.name === collName);
          if (exists) {
            const count = await mongoose.connection.db.collection(collName).countDocuments();
            console.log(`     - ${collName}: ${count} documents`);
          }
        }
        
        await mongoose.connection.close();
        console.log('   Connection closed');
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ ALL CHECKS PASSED');
        console.log('\nMongoDB is accessible and working correctly!');
        console.log('If data is not saving from Next.js, it\'s an application issue, not MongoDB.');
        console.log('='.repeat(70) + '\n');
        
      } else {
        console.error('   ❌ MONGODB_URI not found in .env.local');
      }
    } else {
      console.error('   ❌ .env.local file not found');
    }
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ MONGODB CONNECTION FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }
}

testMongoDB();

