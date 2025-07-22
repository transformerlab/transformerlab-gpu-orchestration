#!/usr/bin/env python3
"""
Test script to verify WorkOS 5.24.0 integration
"""

import os
import sys
sys.path.append('.')

def test_workos_import():
    """Test that WorkOS can be imported and initialized"""
    try:
        import workos
        print("✅ WorkOS import successful")
        
        # Test client initialization (with dummy values)
        client = workos.WorkOSClient(
            api_key="test_key",
            client_id="test_client"
        )
        print("✅ WorkOS client initialization successful")
        
        # Check required methods exist
        assert hasattr(client.sso, 'get_authorization_url'), "Missing get_authorization_url method"
        assert hasattr(client.sso, 'get_profile_and_token'), "Missing get_profile_and_token method"
        print("✅ Required SSO methods available")
        
        return True
    except Exception as e:
        print(f"❌ WorkOS test failed: {e}")
        return False

def test_backend_import():
    """Test that the backend can be imported with WorkOS 5.24.0"""
    try:
        # Set required environment variables
        os.environ['WORKOS_API_KEY'] = 'test_key'
        os.environ['WORKOS_CLIENT_ID'] = 'test_client'
        os.environ['JWT_SECRET_KEY'] = 'test_secret'
        
        from main import app, workos_client
        print("✅ Backend import successful")
        
        # Check that workos_client is properly initialized
        assert workos_client is not None, "WorkOS client not initialized"
        print("✅ WorkOS client properly initialized in backend")
        
        return True
    except Exception as e:
        print(f"❌ Backend test failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing WorkOS 5.24.0 integration...")
    print("-" * 40)
    
    success = True
    success &= test_workos_import()
    success &= test_backend_import()
    
    print("-" * 40)
    if success:
        print("🎉 All tests passed! WorkOS 5.24.0 is ready to use.")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
        sys.exit(1)
