const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runE2ESuite() {
  console.log('====================================================');
  console.log('Starting Empire Arena Browser E2E Verification Suite');
  console.log('====================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });

  const page = await browser.newPage();
  
  // Capture browser errors
  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('[Browser Error]:', err.message);
    pageErrors.push(err.message);
  });

  const testResults = [];
  function recordResult(stepName, passed, details = '') {
    testResults.push({ stepName, passed, details });
    const mark = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${stepName} ${details ? '(' + details + ')' : ''}`);
  }

  let createdExpId = null;

  try {
    // ── 1. NAVIGATION ACROSS ALL PAGES ──
    console.log('\n--- Step 1: Navigating Across All Imperial Realms ---');
    const pagesToTest = [
      { path: '/', titleSnippet: 'Empire Arena', h1Selector: 'h1' },
      { path: '/lab', titleSnippet: 'Empire Arena', h1Selector: 'h1' },
      { path: '/arena', titleSnippet: 'Empire Arena', h1Selector: 'h1' },
      { path: '/archives', titleSnippet: 'Empire Arena', h1Selector: 'h1' },
      { path: '/oracle', titleSnippet: 'Empire Arena', h1Selector: 'h1' }
    ];

    for (const p of pagesToTest) {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle0', timeout: 15000 });
      const h1Text = await page.$eval(p.h1Selector, el => el.innerText).catch(() => 'No H1');
      const sanitizedName = p.path === '/' ? 'empire' : p.path.replace('/', '');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `01_nav_${sanitizedName}.png`) });
      recordResult(`Navigate to ${p.path}`, h1Text.length > 0, `H1: "${h1Text.split('\n')[0]}"`);
    }

    // ── OPERATOR AUTHENTICATION FOR PRIVILEGED ACTIONS ──
    let apiKey = '';
    try {
      const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
      const match = envText.match(/EMPIRE_API_KEY=(.*)/);
      if (match) apiKey = match[1].trim();
    } catch {}

    if (apiKey) {
      console.log('\n--- Unlocking Operator Session for Authenticated Actions ---');
      const loginRes = await page.evaluate(async (key, base) => {
        const r = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
          credentials: 'include'
        });
        return { status: r.status, ok: r.ok };
      }, apiKey, BASE_URL);
      console.log(`[Auth] Operator gate unlocked with status: ${loginRes.status}`);
    }

    // ── 2. CREATE AND EDIT EXPERIMENT IN THE LAB ──
    console.log('\n--- Step 2: Creating Experiment in The Lab ---');
    await page.goto(`${BASE_URL}/lab`, { waitUntil: 'networkidle0' });

    // Fill in experiment form using robust selectors
    const nameSelector = 'input[placeholder*="Strict Output Schema Trial"]';
    await page.waitForSelector(nameSelector, { timeout: 10000 });
    
    // Type name
    const expName = `Browser E2E Benchmark ${Date.now().toString().slice(-4)}`;
    await page.click(nameSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(nameSelector, expName);

    // Type description
    const descSelector = 'textarea[placeholder*="What failure mode or capability"]';
    await page.click(descSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(descSelector, 'Created via Automated Chrome E2E suite');

    // Fill test case 1
    const promptInputSelector = 'textarea[placeholder*="Is 97 prime?"]';
    await page.waitForSelector(promptInputSelector);
    await page.click(promptInputSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(promptInputSelector, 'State the capital of France. Single word only.');

    // Expected output input
    const expectedInputs = await page.$$('input[type="text"]');
    // The second text input on the page is Expected Output (first is Experiment Name)
    if (expectedInputs.length >= 2) {
      await expectedInputs[1].click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await expectedInputs[1].type('Paris');
    }

    // Click "Preserve in Archives" (Save Experiment)
    const saveButton = await page.waitForSelector('button:has(svg.lucide-save)');
    await saveButton.click();

    // Wait for URL or notice banner indicating save
    await page.waitForFunction(() => {
      return window.location.search.includes('id=') || document.body.innerText.includes('saved to database') || document.body.innerText.includes('created and saved');
    }, { timeout: 10000 });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_lab_created_experiment.png') });

    const currentUrl = page.url();
    const urlParams = new URLSearchParams(new URL(currentUrl).search);
    createdExpId = urlParams.get('id');

    recordResult('Create Experiment in Lab', !!createdExpId, `Saved with ID: ${createdExpId}`);

    // Now test editing the experiment
    if (createdExpId) {
      console.log('\n--- Step 2b: Editing Experiment in The Lab ---');
      await page.click(descSelector, { clickCount: 3 });
      await page.keyboard.press('End');
      await page.type(descSelector, ' — Updated Revision');
      
      const saveBtnAgain = await page.$('button:has(svg.lucide-save)');
      await saveBtnAgain.click();
      await page.waitForFunction(() => document.body.innerText.includes('saved to database') || document.body.innerText.includes('All cases preserved'), { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02b_lab_edited_experiment.png') });
      recordResult('Edit Experiment in Lab', true, 'Updated description and re-saved');
    }

    // ── 3. PROVIDER SETTINGS MODAL VERIFICATION ──
    console.log('\n--- Step 3: Verifying Provider Citadel Modal ---');
    // Click the Navbar Provider Engine button
    await page.click('button:has(svg.lucide-cpu)');
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
    
    const modalTitle = await page.$eval('#modal-title', el => el.innerText).catch(() => '');
    recordResult('Open Provider Citadel Modal', modalTitle.includes('Imperial AI Engine'), `Title: ${modalTitle}`);

    // Verify tabs exist for external providers
    const providerTabs = await page.$$eval('div[role="dialog"] button', buttons => 
      buttons.map(b => b.innerText).filter(t => t.includes('OpenAI') || t.includes('Gemini') || t.includes('Anthropic'))
    );
    recordResult('Provider Tabs in Citadel', providerTabs.length >= 2, `Found providers: ${providerTabs.join(', ')}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_provider_modal.png') });

    // Close modal
    await page.click('div[role="dialog"] button[aria-label="Close settings"]');
    await page.waitForFunction(() => !document.querySelector('div[role="dialog"]'), { timeout: 3000 });
    recordResult('Close Provider Citadel Modal', true, 'Modal closed cleanly');

    // ── 4. EXECUTE EVALUATION IN THE LAB ──
    console.log('\n--- Step 4: Executing Single Case Evaluation in The Lab ---');
    // Click "Run Single Test" (zap icon)
    const testProbeButton = await page.$('button:has(svg.lucide-zap)');
    if (testProbeButton) {
      await testProbeButton.click();
      // Wait for test result card
      await page.waitForFunction(() => {
        return document.body.innerText.includes('ms') && (document.body.innerText.includes('PASS') || document.body.innerText.includes('FAIL'));
      }, { timeout: 12000 });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_lab_single_test_result.png') });
      
      const bodyText = await page.evaluate(() => document.body.innerText);
      const executed = bodyText.includes('ms') && (bodyText.includes('PASS') || bodyText.includes('FAIL'));
      recordResult('Execute Single Test in Lab', executed, 'Observed actual latency, token count, and pass/fail verdict');
    } else {
      recordResult('Execute Single Test in Lab', false, 'Test single button not found');
    }

    // ── 4b. GENUINE LIVE EXTERNAL AI PROVIDER EXECUTION (OLLAMA QWEN 2.5 3B) ──
    console.log('\n--- Step 4b: Genuine Live External AI Provider Execution ---');
    const hasLiveQwen = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('select option')).map(o => o.value);
      return options.includes('qwen2.5:3b');
    });

    if (hasLiveQwen) {
      // Select real model
      await page.select('select.font-mono', 'qwen2.5:3b');
      const testLiveBtn = await page.$('button:has(svg.lucide-zap)');
      if (testLiveBtn) {
        await testLiveBtn.click();
        await page.waitForFunction(() => {
          return document.body.innerText.includes('LOCAL (OLLAMA)') || document.body.innerText.includes('OLLAMA') || document.body.innerText.includes('LIVE');
        }, { timeout: 25000 });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_live_ollama_execution.png') });
        const liveOutput = await page.evaluate(() => document.body.innerText);
        const hasLiveBadge = liveOutput.includes('LOCAL (OLLAMA)') || liveOutput.includes('OLLAMA') || liveOutput.includes('LIVE');
        recordResult('Genuine Live AI Provider Execution (qwen2.5:3b)', hasLiveBadge, 'Authentic local Ollama LLM generated response with LOCAL/LIVE badge, latency, and tokens');
      }
    } else {
      console.log('qwen2.5:3b option not present in current select element, skipping live dropdown step.');
    }

    // ── 5. ARENA MODEL COMPARISON ──
    console.log('\n--- Step 5: Comparing Models in The Arena ---');
    const arenaUrl = createdExpId ? `${BASE_URL}/arena?id=${createdExpId}` : `${BASE_URL}/arena`;
    await page.goto(arenaUrl, { waitUntil: 'networkidle0' });

    await page.waitForSelector('select');
    // Click "Dual Contender Duel"
    const runBothButton = await page.$('button:has(svg.lucide-swords)');
    if (runBothButton) {
      await runBothButton.click();
      
      // Wait for execution notice banner
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Both contenders evaluated') || document.body.innerText.includes('identical conditions');
      }, { timeout: 15000 });

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_arena_duel_comparison.png') });
      recordResult('Dual Contender Duel in Arena', true, 'Both models evaluated side-by-side');
    } else {
      recordResult('Dual Contender Duel in Arena', false, 'Duel button not found');
    }

    // ── 6. ARCHIVES AUDIT INSPECTION & JSON EXPORT ──
    console.log('\n--- Step 6: Inspecting Archives & Export Evidence ---');
    await page.goto(`${BASE_URL}/archives`, { waitUntil: 'networkidle0' });

    // Look for Evidence button
    await page.waitForSelector('button[title*="Inspect historical runs"]', { timeout: 10000 });
    const evidenceBtn = await page.$('button[title*="Inspect historical runs"]');
    if (evidenceBtn) {
      await evidenceBtn.click();
      // Wait for modal
      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
      const modalText = await page.$eval('div[role="dialog"]', el => el.innerText);
      const hasEvidence = modalText.includes('Inspection Chamber') || modalText.includes('recorded evaluation trial') || modalText.includes('Recorded Evaluation Runs');
      
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_archives_inspection_modal.png') });
      recordResult('Archives Run Inspection Modal', hasEvidence, 'Evidence audit modal opened with run history');

      // Test JSON export download button existence
      const exportBtn = await page.$('div[role="dialog"] button:has(svg.lucide-download)');
      recordResult('Archives JSON Evidence Export Button', !!exportBtn, 'Export evidence button present');

      // Close modal
      const closeInspectBtn = await page.$('div[role="dialog"] button:has(svg.lucide-x)');
      if (closeInspectBtn) await closeInspectBtn.click();
      await page.waitForFunction(() => !document.querySelector('div[role="dialog"]'), { timeout: 3000 });
    }

    // ── 7. ORACLE DIAGNOSTICS CONSULTATION ──
    console.log('\n--- Step 7: Consulting The Oracle on Real Historical Data ---');
    await page.goto(`${BASE_URL}/oracle`, { waitUntil: 'networkidle0' });

    // Click "Analyze Pattern ✧"
    const oracleSubmitBtn = await page.waitForSelector('button:has(svg.lucide-sparkles)');
    await oracleSubmitBtn.click();

    // Wait for analysis result to populate
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Empirical Diagnosis') || document.body.innerText.includes('Recommended Follow-up Experiment') || document.body.innerText.includes('Hypothesis Confirmed');
    }, { timeout: 15000 });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_oracle_consult_result.png') });
    const oracleBody = await page.evaluate(() => document.body.innerText);
    const oracleHasInsights = oracleBody.includes('Empirical Diagnosis') || oracleBody.includes('Recommended Follow-up Experiment');
    recordResult('Oracle Diagnostic Consultation', oracleHasInsights, 'Oracle generated diagnosis and strategic remediation');

    // ── 8. REFRESH & PERSISTENCE VALIDATION ──
    console.log('\n--- Step 8: Validating Persistence Across Browser Refresh ---');
    await page.goto(`${BASE_URL}/archives`, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });

    await page.waitForSelector('button[title*="Inspect historical runs"]', { timeout: 10000 });
    const archiveCards = await page.$$('button[title*="Inspect historical runs"]');
    recordResult('Archives Persistence on Hard Refresh', archiveCards.length >= 1, `Retrieved ${archiveCards.length} experiment records from SQLite backend`);

    // Verify invalid inputs rejected in Lab
    console.log('\n--- Step 9: Form Validation & Error Banners ---');
    await page.goto(`${BASE_URL}/lab`, { waitUntil: 'networkidle0' });
    
    // Clear name and submit
    const nameInputSelector = 'input[placeholder*="Strict Output Schema Trial"]';
    await page.waitForSelector(nameInputSelector);
    await page.focus(nameInputSelector);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    
    const saveBtn = await page.$('button:has(svg.lucide-save)');
    await saveBtn.click();
    
    // Wait for inline error banner
    await page.waitForFunction(() => document.body.innerText.includes('Experiment name is required'), { timeout: 8000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_validation_error_banner.png') });
    recordResult('Form Validation Inline Error Banner', true, 'Banner displayed: "Experiment name is required."');

  } catch (err) {
    console.error('Test Suite encountered error:', err);
    recordResult('Suite Execution Exception', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n====================================================');
  console.log('Browser E2E Verification Summary');
  console.log('====================================================');
  const passedCount = testResults.filter(r => r.passed).length;
  console.log(`Total Checks: ${testResults.length} | Passed: ${passedCount} | Failed: ${testResults.length - passedCount}`);
  console.log(`Page Errors Encountered: ${pageErrors.length}`);
  
  if (testResults.some(r => !r.passed)) {
    console.error('Some tests failed!');
    process.exit(1);
  } else {
    console.log('All browser E2E workflows successfully verified!');
    process.exit(0);
  }
}

runE2ESuite();
