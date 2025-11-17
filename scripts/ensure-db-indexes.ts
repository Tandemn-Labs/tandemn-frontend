#!/usr/bin/env tsx
/**
 * Script to ensure all database indexes are created for optimal query performance
 * Run with: npx tsx scripts/ensure-db-indexes.ts
 */

import mongoose from 'mongoose';
import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';
import UserAPIKey from '../src/lib/models/UserAPIKey';
import Conversation from '../src/lib/models/Conversation';
import Message from '../src/lib/models/Message';
import BatchInferenceTask from '../src/lib/models/BatchInferenceTask';

async function ensureIndexes() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await dbConnect();
    
    console.log('📊 Creating indexes for all collections...\n');
    
    // Ensure indexes for each model
    const models = [
      { name: 'UserAccount', model: UserAccount },
      { name: 'UserTransaction', model: UserTransaction },
      { name: 'UserAPIKey', model: UserAPIKey },
      { name: 'Conversation', model: Conversation },
      { name: 'Message', model: Message },
      { name: 'BatchInferenceTask', model: BatchInferenceTask },
    ];
    
    for (const { name, model } of models) {
      console.log(`⏳ Creating indexes for ${name}...`);
      try {
        await model.createIndexes();
        
        // Get index information
        const indexes = await model.collection.getIndexes();
        console.log(`✅ ${name}: ${Object.keys(indexes).length} indexes created`);
        
        // Log index details
        for (const [indexName, indexSpec] of Object.entries(indexes)) {
          console.log(`   - ${indexName}: ${JSON.stringify(indexSpec.keys)}`);
        }
        console.log('');
      } catch (error) {
        console.error(`❌ Error creating indexes for ${name}:`, error);
      }
    }
    
    console.log('✨ All indexes have been ensured!\n');
    
    // Show collection stats
    console.log('📈 Collection Statistics:');
    for (const { name, model } of models) {
      try {
        const count = await model.countDocuments();
        console.log(`   ${name}: ${count} documents`);
      } catch (error) {
        console.log(`   ${name}: Error getting count`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to ensure indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the script
ensureIndexes();

