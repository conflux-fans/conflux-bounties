const axios = require('axios');

async function testAxios() {
  console.log('Testing axios directly...');
  
  try {
    const response = await axios.post('http://httpbin.org/post', {
      test: 'data',
      event: 'Transfer'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      validateStatus: () => true
    });
    
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAxios();