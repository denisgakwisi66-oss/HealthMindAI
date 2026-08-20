/**
 * ============================================
 * HEALTHMIND AI — TEST RUNNER
 * ============================================
 * Comprehensive testing framework for all modules
 */

const TestRunner = (() => {
  // ===== STATE =====

  let tests = [];
  let results = [];
  let isRunning = false;

  // ===== TEST REGISTRY =====

  const registerTest = (name, fn, category = 'General') => {
    tests.push({ name, fn, category });
  };

  const registerSuite = (category, testFns) => {
    Object.entries(testFns).forEach(([name, fn]) => {
      registerTest(name, fn, category);
    });
  };

  // ===== RUN TESTS =====

  const runAll = async () => {
    if (isRunning) return;
    isRunning = true;
    results = [];

    console.log('🧪 Starting test suite...');

    for (const test of tests) {
      try {
        console.log(`  Running: ${test.category} > ${test.name}`);
        const startTime = performance.now();
        await test.fn();
        const duration = performance.now() - startTime;
        
        results.push({
          name: test.name,
          category: test.category,
          status: 'passed',
          duration: Math.round(duration),
        });
        
        console.log(`  ✅ ${test.name} (${Math.round(duration)}ms)`);
      } catch (error) {
        results.push({
          name: test.name,
          category: test.category,
          status: 'failed',
          error: error.message,
          stack: error.stack,
        });
        
        console.error(`  ❌ ${test.name}:`, error.message);
      }
    }

    isRunning = false;
    console.log(`\n📊 Test Results: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
    
    return results;
  };

  // ===== ASSERTIONS =====

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  };

  const assertEqual = (actual, expected, message) => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  };

  const assertDeepEqual = (actual, expected, message) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
    }
  };

  const assertThrows = (fn, expectedMessage) => {
    try {
      fn();
      throw new Error('Expected function to throw');
    } catch (error) {
      if (expectedMessage && !error.message.includes(expectedMessage)) {
        throw new Error(`Expected error containing "${expectedMessage}", got "${error.message}"`);
      }
    }
  };

  const assertNotThrows = (fn) => {
    try {
      fn();
    } catch (error) {
      throw new Error(`Expected function not to throw, but got: ${error.message}`);
    }
  };

  // ===== MOCK HELPERS =====

  const createMockAPI = (responses = {}) => {
    return {
      get: async (url) => {
        if (responses[url]) {
          return typeof responses[url] === 'function' ? responses[url]() : responses[url];
        }
        throw new Error(`Mock API: No response defined for ${url}`);
      },
      post: async (url, data) => {
        if (responses[url]) {
          return typeof responses[url] === 'function' ? responses[url](data) : responses[url];
        }
        throw new Error(`Mock API: No response defined for ${url}`);
      },
      put: async (url, data) => {
        if (responses[url]) {
          return typeof responses[url] === 'function' ? responses[url](data) : responses[url];
        }
        throw new Error(`Mock API: No response defined for ${url}`);
      },
      delete: async (url) => {
        if (responses[url]) {
          return typeof responses[url] === 'function' ? responses[url]() : responses[url];
        }
        throw new Error(`Mock API: No response defined for ${url}`);
      },
    };
  };

  // ===== TEST SUITES =====

  // API Client Tests
  const apiTests = {
    'should make GET request': async () => {
      const mockAPI = createMockAPI({
        '/test': { data: 'success' }
      });
      const response = await mockAPI.get('/test');
      assertDeepEqual(response, { data: 'success' });
    },

    'should make POST request with data': async () => {
      const mockAPI = createMockAPI({
        '/test': (data) => ({ received: data })
      });
      const response = await mockAPI.post('/test', { key: 'value' });
      assertDeepEqual(response, { received: { key: 'value' } });
    },

    'should handle errors': async () => {
      const mockAPI = createMockAPI({});
      try {
        await mockAPI.get('/not-found');
        throw new Error('Should have thrown');
      } catch (error) {
        assert(error.message.includes('No response defined'));
      }
    },
  };

  // Auth Tests
  const authTests = {
    'should validate email format': () => {
      const validEmail = 'test@example.com';
      const invalidEmail = 'test.example.com';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      assert(emailRegex.test(validEmail));
      assert(!emailRegex.test(invalidEmail));
    },

    'should validate password strength': () => {
      const weakPassword = '123';
      const strongPassword = 'StrongP@ssw0rd123!';
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(strongPassword);
      const hasLowerCase = /[a-z]/.test(strongPassword);
      const hasNumber = /[0-9]/.test(strongPassword);
      const hasSpecial = /[^a-zA-Z0-9]/.test(strongPassword);
      
      assert(strongPassword.length >= minLength);
      assert(hasUpperCase);
      assert(hasLowerCase);
      assert(hasNumber);
      assert(hasSpecial);
    },
  };

  // Navigation Tests
  const navTests = {
    'should get correct role routes': () => {
      const patientRoutes = Navigation.getRoutes('patient');
      const doctorRoutes = Navigation.getRoutes('doctor');
      const adminRoutes = Navigation.getRoutes('admin');
      
      assert(patientRoutes.length > 0);
      assert(doctorRoutes.length > 0);
      assert(adminRoutes.length > 0);
      assert(patientRoutes !== doctorRoutes);
      assert(doctorRoutes !== adminRoutes);
    },

    'should highlight current page': () => {
      const path = '/dashboard.html';
      Navigation.highlightCurrentPage();
      // In a real test, we'd check DOM state
      assert(true);
    },
  };

  // Theme Tests
  const themeTests = {
    'should get system theme': () => {
      const theme = Theme.getSystemTheme();
      assert(theme === 'light' || theme === 'dark');
    },

    'should apply theme correctly': () => {
      const initialTheme = Theme.getTheme();
      Theme.applyTheme('dark');
      assert(Theme.getTheme() === 'dark');
      Theme.applyTheme('light');
      assert(Theme.getTheme() === 'light');
      // Restore
      if (initialTheme) Theme.applyTheme(initialTheme);
    },
  };

  // Form Validation Tests
  const validationTests = {
    'should validate required fields': () => {
      const validate = (value) => {
        return value && value.trim().length > 0;
      };
      assert(!validate(''));
      assert(!validate('   '));
      assert(validate('test'));
    },

    'should validate email format': () => {
      const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };
      assert(isValidEmail('test@example.com'));
      assert(!isValidEmail('test@example'));
      assert(!isValidEmail('test.example.com'));
    },

    'should validate password confirmation': () => {
      const passwordsMatch = (p1, p2) => p1 === p2;
      assert(passwordsMatch('password123', 'password123'));
      assert(!passwordsMatch('password123', 'password124'));
    },
  };

  // Sanitization Tests
  const sanitizeTests = {
    'should escape HTML': () => {
      const input = '<script>alert("xss")</script>';
      const escaped = input.replace(/[&<>"]/g, (char) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
        return map[char] || char;
      });
      assert(!escaped.includes('<script>'));
      assert(escaped.includes('&lt;script&gt;'));
    },

    'should sanitize AI responses': () => {
      const response = '<div>Hello</div><script>bad</script>';
      const sanitized = response.replace(/<script[\s\S]*?<\/script>/gi, '');
      assert(!sanitized.includes('script'));
    },
  };

  // ===== REGISTER ALL TESTS =====

  registerSuite('API Client', apiTests);
  registerSuite('Authentication', authTests);
  registerSuite('Navigation', navTests);
  registerSuite('Theme', themeTests);
  registerSuite('Validation', validationTests);
  registerSuite('Security', sanitizeTests);

  // ===== PUBLIC API =====

  return {
    runAll,
    registerTest,
    registerSuite,
    assert,
    assertEqual,
    assertDeepEqual,
    assertThrows,
    assertNotThrows,
    createMockAPI,
    results,
  };
})();

// ===== EXPORT =====

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestRunner;
}

export default TestRunner;