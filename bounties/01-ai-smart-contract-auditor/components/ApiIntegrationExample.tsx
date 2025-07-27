'use client';

import { useState } from 'react';

interface ApiExample {
  title: string;
  description: string;
  code: string;
  language: 'javascript' | 'python' | 'curl';
}

const apiExamples: ApiExample[] = [
  {
    title: 'Start Audit (JavaScript)',
    description: 'Start a new smart contract audit using JavaScript/Node.js',
    language: 'javascript',
    code: `// Start a new audit
const response = await fetch('/api/audit/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    address: '0x22f41abf77905f50df398f21213290597e7414dd',
    format: 'json' // or 'markdown'
  })
});

// Handle streaming response
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const message = JSON.parse(line);
      console.log(\`Progress: \${message.progress}% - \${message.message}\`);
      
      if (message.type === 'complete') {
        console.log('Audit completed!', message.report);
      }
    } catch (e) {
      // Handle parsing errors
    }
  }
}`
  },
  {
    title: 'Batch Audit (JavaScript)',
    description: 'Process multiple contracts in a single batch request',
    language: 'javascript',
    code: `// Start batch audit
const batchResponse = await fetch('/api/audit/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    addresses: [
      '0x22f41abf77905f50df398f21213290597e7414dd',
      '0x1234567890123456789012345678901234567890'
    ],
    options: {
      maxConcurrency: 5,
      includeResults: false
    }
  })
});

const { batchId } = await batchResponse.json();

// Poll for batch completion
const pollBatchStatus = async () => {
  const statusResponse = await fetch(\`/api/audit/batch?batchId=\${batchId}\`);
  const status = await statusResponse.json();
  
  console.log(\`Batch progress: \${status.completedJobs}/\${status.totalJobs}\`);
  
  if (status.status === 'completed') {
    console.log('Batch completed!', status.summary);
    return status;
  } else if (status.status === 'processing') {
    setTimeout(pollBatchStatus, 3000); // Poll every 3 seconds
  }
};

await pollBatchStatus();`
  },
  {
    title: 'Webhook Configuration (JavaScript)',
    description: 'Set up webhooks to receive audit completion notifications',
    language: 'javascript',
    code: `// Configure webhook for audit completion notifications
const webhookResponse = await fetch('/api/webhook/configure', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-app.com/webhook/audit-complete',
    events: ['audit_completed', 'batch_completed'],
    secret: 'your-webhook-secret',
    active: true
  })
});

const webhookConfig = await webhookResponse.json();
console.log('Webhook configured:', webhookConfig.id);

// Example webhook handler (Express.js)
app.post('/webhook/audit-complete', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'audit_completed') {
    console.log(\`Audit completed for \${data.address}\`);
    console.log(\`Findings: \${data.findingsCount}\`);
    console.log(\`Report ID: \${data.reportId}\`);
    
    // Process the completed audit
    processAuditResults(data);
  }
  
  res.status(200).send('OK');
});`
  },
  {
    title: 'Get Report (cURL)',
    description: 'Retrieve audit report using cURL',
    language: 'curl',
    code: `# Get audit report by report ID
curl -X GET "http://localhost:3000/api/audit/report/report_123456789" \\
  -H "Accept: application/json"

# Get reports for specific address
curl -X GET "http://localhost:3000/api/reports/0x22f41abf77905f50df398f21213290597e7414dd/history" \\
  -H "Accept: application/json"

# Get report statistics
curl -X GET "http://localhost:3000/api/reports/stats" \\
  -H "Accept: application/json"`
  },
  {
    title: 'Python Integration',
    description: 'Complete Python example for audit integration',
    language: 'python',
    code: `import requests
import json
import time

class ConfluxAuditor:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def start_audit(self, contract_address, format="json"):
        """Start a new audit and return the report"""
        url = f"{self.base_url}/api/audit/start"
        payload = {
            "address": contract_address,
            "format": format
        }
        
        response = requests.post(url, json=payload, stream=True)
        response.raise_for_status()
        
        # Process streaming response
        for line in response.iter_lines():
            if line:
                try:
                    message = json.loads(line.decode('utf-8'))
                    print(f"Progress: {message.get('progress', 0)}% - {message.get('message', '')}")
                    
                    if message.get('type') == 'complete':
                        return message.get('report')
                        
                except json.JSONDecodeError:
                    continue
    
    def start_batch_audit(self, addresses, max_concurrency=5):
        """Start batch audit and poll for completion"""
        url = f"{self.base_url}/api/audit/batch"
        payload = {
            "addresses": addresses,
            "options": {
                "maxConcurrency": max_concurrency,
                "includeResults": False
            }
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        batch_id = response.json()["batchId"]
        return self.poll_batch_status(batch_id)
    
    def poll_batch_status(self, batch_id):
        """Poll batch status until completion"""
        url = f"{self.base_url}/api/audit/batch"
        
        while True:
            response = requests.get(url, params={"batchId": batch_id})
            response.raise_for_status()
            
            status = response.json()
            progress = f"{status['completedJobs']}/{status['totalJobs']}"
            print(f"Batch progress: {progress}")
            
            if status["status"] == "completed":
                return status
            elif status["status"] == "processing":
                time.sleep(3)  # Wait 3 seconds before next poll
            else:
                raise Exception(f"Batch failed: {status.get('error', 'Unknown error')}")

# Usage example
auditor = ConfluxAuditor()

# Single audit
report = auditor.start_audit("0x22f41abf77905f50df398f21213290597e7414dd")
print(f"Audit completed with {len(report['findings'])} findings")

# Batch audit
addresses = [
    "0x22f41abf77905f50df398f21213290597e7414dd",
    "0x1234567890123456789012345678901234567890"
]
batch_result = auditor.start_batch_audit(addresses)
print(f"Batch completed: {batch_result['summary']}")`
  }
];

export default function ApiIntegrationExample() {
  const [selectedExample, setSelectedExample] = useState(0);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const currentExample = apiExamples[selectedExample];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Integration Examples</h2>
        <p className="text-gray-600">
          Complete code examples for integrating the Smart Contract Auditor API into your development workflow.
        </p>
      </div>

      {/* Example Selector */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {apiExamples.map((example, index) => (
            <button
              key={index}
              onClick={() => setSelectedExample(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedExample === index
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {example.title}
            </button>
          ))}
        </div>
      </div>

      {/* Example Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{currentExample.title}</h3>
            <p className="text-sm text-gray-600">{currentExample.description}</p>
          </div>
          <button
            onClick={() => copyToClipboard(currentExample.code)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-600">Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-100 whitespace-pre-wrap">
            <code>{currentExample.code}</code>
          </pre>
        </div>
      </div>

      {/* API Reference Links */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">API Reference</h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-blue-800">Base URL:</span>
            <span className="ml-2 font-mono text-blue-700">http://localhost:3000</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Documentation:</span>
            <span className="ml-2">See API endpoints for detailed parameter documentation</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Rate Limits:</span>
            <span className="ml-2">No rate limits in development mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}