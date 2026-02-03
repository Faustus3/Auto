/**
 * Start Server with zrok Integration
 * Launches the Node.js backend and creates a zrok tunnel
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuration
const SERVER_PORT = process.env.PORT || 3001;
const BACKEND_DIR = path.join(__dirname, 'backend');
let serverProcess = null;
let zrokProcess = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    log('\n🚀 Starting Auto Dashboard Server...', 'green');
    
    serverProcess = spawn('node', ['server.js'], {
      cwd: BACKEND_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverReady = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`${colors.blue}[SERVER] ${colors.reset}${output}`);
      
      if (output.includes(`Server running on port ${SERVER_PORT}`)) {
        serverReady = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(`${colors.red}[SERVER ERROR] ${colors.reset}${output}`);
    });

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

function startZrok() {
  return new Promise((resolve, reject) => {
    log('\n🌐 Starting zrok tunnel...', 'cyan');
    log(`   Sharing: http://localhost:${SERVER_PORT}`, 'yellow');
    log('   Waiting for zrok to provide public URL...\n', 'yellow');
    
    zrokProcess = spawn('zrok', ['share', 'public', `http://localhost:${SERVER_PORT}`], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let publicUrl = null;

    zrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Look for the zrok URL in the output
      const urlMatch = output.match(/(https?:\/\/[^\s]+\.zrok\.io)/);
      if (urlMatch && !publicUrl) {
        publicUrl = urlMatch[1];
        log('\n✅ PUBLIC URL READY!', 'green');
        log(`   ${publicUrl}`, 'cyan');
        log('\n📱 Your Auto Dashboard is now accessible from anywhere!', 'green');
        log('   Share this URL with friends or access it on your phone.\n', 'yellow');
        resolve(publicUrl);
      }
      
      process.stdout.write(`${colors.cyan}[ZROK] ${colors.reset}${output}`);
    });

    zrokProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(`${colors.red}[ZROK ERROR] ${colors.reset}${output}`);
      
      // Check for common errors
      if (output.includes('not enabled') || output.includes('enable')) {
        log('\n❌ ERROR: zrok is not enabled!', 'red');
        log('   Run: zrok enable <your-token>', 'yellow');
        log('   Get your token from: https://zrok.io\n', 'yellow');
        reject(new Error('zrok not enabled'));
      }
    });

    zrokProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        log('\n❌ ERROR: zrok is not installed or not in PATH!', 'red');
        log('   Install zrok: https://docs.zrok.io/docs/getting-started/', 'yellow');
        log('   Or run: winget install zrok (Windows)\n', 'yellow');
        reject(new Error('zrok not found'));
      } else {
        reject(new Error(`zrok error: ${error.message}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!publicUrl) {
        reject(new Error('zrok failed to provide public URL within 30 seconds'));
      }
    }, 30000);
  });
}

function cleanup() {
  log('\n🛑 Shutting down...', 'yellow');
  
  if (zrokProcess) {
    log('   Stopping zrok tunnel...', 'yellow');
    zrokProcess.kill('SIGTERM');
  }
  
  if (serverProcess) {
    log('   Stopping server...', 'yellow');
    serverProcess.kill('SIGTERM');
  }
  
  setTimeout(() => {
    log('   Goodbye! 👋\n', 'green');
    process.exit(0);
  }, 1000);
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Main execution
async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║       Auto Dashboard with zrok Tunnel                     ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  try {
    // Start the server
    await startServer();
    
    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start zrok tunnel
    const publicUrl = await startZrok();
    
    log('\n💡 Tips:', 'yellow');
    log('   • Press Ctrl+C to stop both server and tunnel', 'reset');
    log('   • The server is running locally on port ' + SERVER_PORT, 'reset');
    log(`   • Public access via: ${publicUrl}`, 'reset');
    log('   • Both server and zrok are running in this terminal\n', 'reset');
    
  } catch (error) {
    log(`\n❌ Failed to start: ${error.message}\n`, 'red');
    cleanup();
    process.exit(1);
  }
}

main();
