async function run() {
  try {
    console.log('Sending clear-chats POST request to production...');
    const response = await fetch('https://chatsphere-ijss.onrender.com/api/admin/clear-chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passcode: 'clear_chats_xyz_987' })
    });
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
