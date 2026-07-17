const fetch = require('node-fetch');
async function test() {
  const res = await fetch('http://localhost:3000/api/world-asset/episodes/PACO_SHOTLIST_SHOW_AND_TELL/storyboard-assets');
  if (res.ok) {
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('Error:', res.status, res.statusText);
  }
}
test();
