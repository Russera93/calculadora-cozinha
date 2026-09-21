// Minimal localStorage polyfill for Node.js testing
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, value) => {
    storage[key] = value;
  }
};

// crypto.randomUUID polyfill for older Node versions
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Dynamic import for ES modules
(async () => {
  const {
    createEmptyRecipe,
    saveRecipe,
    getRecipes,
    duplicateRecipe,
    deleteRecipe
  } = await import('../js/storage.js');

  console.log('Starting storage.js smoke test...\n');

  // Step 1: Create empty recipe
  const r = createEmptyRecipe();
  console.log('✓ createEmptyRecipe() returned a recipe with id:', r.id);

  // Step 2: Save recipe
  r.nome = 'Teste';
  saveRecipe(r);
  console.log('✓ saveRecipe() saved the recipe');

  // Step 3: Get recipes (should show 1 recipe named "Teste")
  const recipes1 = getRecipes();
  console.log(`✓ getRecipes() returned ${recipes1.length} recipe(s)`);
  console.log('  Recipe:', recipes1[0].nome, '- ID:', recipes1[0].id);
  if (recipes1.length !== 1 || recipes1[0].nome !== 'Teste') {
    throw new Error('Expected 1 recipe named "Teste"');
  }

  // Step 4: Duplicate recipe
  const dup = duplicateRecipe(r.id);
  console.log(`✓ duplicateRecipe() created a copy with nome: "${dup.nome}"`);

  // Step 5: Verify we have 2 recipes
  const recipes2 = getRecipes();
  console.log(`✓ getRecipes() returned ${recipes2.length} recipe(s)`);
  if (recipes2.length !== 2) {
    throw new Error(`Expected 2 recipes after duplication, got ${recipes2.length}`);
  }

  // Step 6: Delete the duplicate
  deleteRecipe(dup.id);
  console.log(`✓ deleteRecipe(dup.id) deleted the duplicate`);

  // Step 7: Verify we're back to 1 recipe
  const recipes3 = getRecipes();
  console.log(`✓ getRecipes() returned ${recipes3.length} recipe(s)`);
  if (recipes3.length !== 1) {
    throw new Error(`Expected 1 recipe after deleting duplicate, got ${recipes3.length}`);
  }

  // Step 8: Delete the original
  deleteRecipe(r.id);
  console.log(`✓ deleteRecipe(r.id) deleted the original`);

  // Step 9: Verify we have 0 recipes
  const recipes4 = getRecipes();
  console.log(`✓ getRecipes() returned ${recipes4.length} recipe(s)`);
  if (recipes4.length !== 0) {
    throw new Error(`Expected 0 recipes after deleting all, got ${recipes4.length}`);
  }

  console.log('\n✅ All smoke tests passed!');
})().catch(err => {
  console.error('\n❌ Smoke test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
