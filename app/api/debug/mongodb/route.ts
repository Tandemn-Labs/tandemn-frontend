import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/database';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    console.log('\n🔍 MONGODB DEBUG CHECK');
    console.log('='.repeat(60));
    
    // Check environment
    console.log('1. Environment Variables:');
    console.log('   MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('   MONGODB_URI preview:', process.env.MONGODB_URI?.substring(0, 60) + '...');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    
    // Try to connect
    console.log('\n2. Connection Test:');
    const conn = await dbConnect();
    
    console.log('   ✅ Connection successful');
    console.log('   Database name:', conn.connection.db.databaseName);
    console.log('   Connection state:', conn.connection.readyState);
    console.log('   Host:', conn.connection.host);
    
    // List collections
    console.log('\n3. Collections:');
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`   Found ${collections.length} collections:`);
    for (const coll of collections) {
      const count = await conn.connection.db.collection(coll.name).countDocuments();
      console.log(`   - ${coll.name}: ${count} documents`);
    }
    
    // Test write
    console.log('\n4. Write Test:');
    const testCollection = conn.connection.db.collection('_test_connection');
    const testDoc = { test: true, timestamp: new Date() };
    const writeResult = await testCollection.insertOne(testDoc);
    console.log('   ✅ Write successful, ID:', writeResult.insertedId);
    
    // Clean up test
    await testCollection.deleteOne({ _id: writeResult.insertedId });
    console.log('   ✅ Cleanup successful');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL CHECKS PASSED\n');
    
    return NextResponse.json({
      success: true,
      mongodb: {
        connected: true,
        database: conn.connection.db.databaseName,
        host: conn.connection.host,
        state: conn.connection.readyState,
        collections: collections.map(c => c.name),
        env_loaded: !!process.env.MONGODB_URI,
      },
    });
    
  } catch (error) {
    console.error('\n❌ MONGODB DEBUG FAILED:');
    console.error(error);
    console.error('='.repeat(60) + '\n');
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        env_loaded: !!process.env.MONGODB_URI,
      },
      { status: 500 }
    );
  }
}

