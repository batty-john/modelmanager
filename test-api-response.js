console.log('=== TESTING PAGINATION FIX ===');

// Test API with pagination fix
console.log('\nTESTING API PAGINATION:');
fetch('/admin/models/api?page=1&limit=5')
  .then(response => response.json())
  .then(data => {
    console.log('API Response:', data);

    if (data.success && data.data) {
      console.log('\n=== PAGINATION ANALYSIS ===');
      console.log('Current Page:', data.data.pagination.currentPage);
      console.log('Items Per Page:', data.data.pagination.itemsPerPage);
      console.log('Has More:', data.data.pagination.hasMore);
      console.log('Total Items:', data.data.pagination.totalItems);
      console.log('Loaded Items:', data.data.pagination.loadedItems);

      console.log('\n=== DATA ANALYSIS ===');
      console.log('Adults loaded:', data.data.adults.length);
      console.log('Children loaded:', data.data.children.length);
      console.log('Total items this page:', data.data.adults.length + data.data.children.length);

      const expectedHasMore = data.data.pagination.loadedItems < data.data.pagination.totalItems;
      console.log('Expected hasMore:', expectedHasMore);
      console.log('API hasMore matches expected:', data.data.pagination.hasMore === expectedHasMore);

    } else {
      console.error('❌ API call failed:', data.error);
    }
  })
  .catch(error => console.error('❌ Network error:', error));

console.log('\n⚠️  Check your SERVER CONSOLE for detailed pagination debug logs!');