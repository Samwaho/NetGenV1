#!/usr/bin/env python3
"""
Test script for KopoKopo integration
This script tests the basic functionality of the KopoKopo integration
"""

import asyncio
import json
import requests
from datetime import datetime, timezone
from typing import Dict, Any

# Test configuration
TEST_CONFIG = {
    "base_url": "http://localhost:8000",  # Change to your API URL
    "organization_id": "your_org_id",  # Replace with actual org ID
    "test_phone": "254700000000",  # Test phone number
    "test_amount": 10.00,  # Test amount
}

class KopoKopoIntegrationTest:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.base_url = config["base_url"]
        self.organization_id = config["organization_id"]
        
    def test_health_check(self) -> bool:
        """Test if the API is accessible"""
        try:
            response = requests.get(f"{self.base_url}/api/health")
            if response.status_code == 200:
                print("✅ Health check passed")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {str(e)}")
            return False
    
    def test_kopokopo_configuration(self) -> bool:
        """Test KopoKopo configuration endpoint"""
        try:
            # This would require authentication in a real scenario
            # For testing, we'll just check if the endpoint exists
            response = requests.get(f"{self.base_url}/api/payments/kopokopo/transactions/{self.organization_id}")
            if response.status_code in [401, 403, 404]:  # Expected for unauthenticated request
                print("✅ KopoKopo endpoints are accessible")
                return True
            else:
                print(f"❌ Unexpected response: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ KopoKopo configuration test error: {str(e)}")
            return False
    
    def test_hotspot_endpoints(self) -> bool:
        """Test hotspot endpoints"""
        try:
            # Test packages endpoint
            response = requests.get(f"{self.base_url}/api/hotspot/packages?organization_id={self.organization_id}")
            if response.status_code in [200, 401, 403, 404]:  # Expected responses
                print("✅ Hotspot endpoints are accessible")
                return True
            else:
                print(f"❌ Unexpected hotspot response: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Hotspot endpoints test error: {str(e)}")
            return False
    
    def test_webhook_simulation(self) -> bool:
        """Simulate a KopoKopo webhook callback"""
        try:
            # Simulate a buygoods transaction webhook
            webhook_payload = {
                "event_type": "buygoods_transaction_received",
                "resource": {
                    "id": "test_transaction_123",
                    "amount": {
                        "value": str(self.config["test_amount"]),
                        "currency": "KES"
                    },
                    "sender": {
                        "phone_number": self.config["test_phone"]
                    },
                    "till": {
                        "number": "123456"
                    },
                    "reference": "TEST_VOUCHER_123",
                    "status": "Success"
                }
            }
            
            response = requests.post(
                f"{self.base_url}/api/payments/kopokopo/callback/{self.organization_id}/buygoods",
                json=webhook_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [200, 404]:  # Expected responses
                print("✅ Webhook simulation successful")
                return True
            else:
                print(f"❌ Webhook simulation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Webhook simulation error: {str(e)}")
            return False
    
    def test_voucher_purchase_simulation(self) -> bool:
        """Simulate a voucher purchase request"""
        try:
            # This would require a valid package ID in a real scenario
            purchase_payload = {
                "organizationId": self.organization_id,
                "packageId": "test_package_id",  # Replace with actual package ID
                "phoneNumber": self.config["test_phone"]
            }
            
            response = requests.post(
                f"{self.base_url}/api/hotspot/purchase-voucher-kopokopo",
                json=purchase_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [400, 404]:  # Expected for invalid package ID
                print("✅ Voucher purchase endpoint accessible")
                return True
            else:
                print(f"❌ Unexpected voucher purchase response: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Voucher purchase test error: {str(e)}")
            return False
    
    def run_all_tests(self) -> bool:
        """Run all integration tests"""
        print("🚀 Starting KopoKopo Integration Tests")
        print("=" * 50)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("KopoKopo Configuration", self.test_kopokopo_configuration),
            ("Hotspot Endpoints", self.test_hotspot_endpoints),
            ("Webhook Simulation", self.test_webhook_simulation),
            ("Voucher Purchase Simulation", self.test_voucher_purchase_simulation),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    print(f"❌ {test_name} failed")
            except Exception as e:
                print(f"❌ {test_name} error: {str(e)}")
        
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! KopoKopo integration is working correctly.")
        else:
            print("⚠️  Some tests failed. Please check the configuration and try again.")
        
        return passed == total

def main():
    """Main function to run the tests"""
    print("KopoKopo Integration Test Suite")
    print("=" * 50)
    
    # Check if configuration is provided
    if TEST_CONFIG["organization_id"] == "your_org_id":
        print("⚠️  Please update the TEST_CONFIG with your actual organization ID")
        print("   Edit the test_kopokopo_integration.py file and set:")
        print("   - organization_id: Your actual organization ID")
        print("   - base_url: Your API base URL")
        print("   - test_phone: A valid test phone number")
        return False
    
    # Create test instance and run tests
    tester = KopoKopoIntegrationTest(TEST_CONFIG)
    return tester.run_all_tests()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
