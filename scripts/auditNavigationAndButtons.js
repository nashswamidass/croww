const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

const allFiles = getAllFiles(srcDir);

// 1. Registered Routes in AppNavigator & PropertyTabNavigator
const appNavigatorContent = fs.readFileSync(path.join(srcDir, 'navigation/AppNavigator.js'), 'utf8');
const tabNavigatorContent = fs.readFileSync(path.join(srcDir, 'navigation/PropertyTabNavigator.js'), 'utf8');
const linkingContent = fs.readFileSync(path.join(srcDir, 'navigation/linking.js'), 'utf8');

const registeredStackScreens = new Set();
const screenTagRegex = /<Stack\.Screen\s+name=["']([^"']+)["']\s+component={([^}]+)}/g;
let match;
while ((match = screenTagRegex.exec(appNavigatorContent)) !== null) {
    registeredStackScreens.add(match[1]);
}

const registeredTabScreens = new Set();
const tabTagRegex = /<Tab\.Screen\s+name={?([^"'\s}]+|[TABS\.]+)["']?\s+component={([^}]+)}/g;
while ((match = tabTagRegex.exec(tabNavigatorContent)) !== null) {
    let name = match[1].replace(/TABS\./, '').replace(/['"]/g, '');
    registeredTabScreens.add(name);
}

console.log('=== REGISTERED STACK SCREENS ===');
console.log(Array.from(registeredStackScreens).sort());

console.log('\n=== REGISTERED TAB SCREENS ===');
console.log(Array.from(registeredTabScreens).sort());

// 2. Scan Screen Files in src/screens
const screenFiles = allFiles.filter(f => f.includes('/screens/'));
const screenNames = screenFiles.map(f => path.basename(f, path.extname(f)).replace(/\.web$/, ''));
const uniqueScreenComponents = Array.from(new Set(screenNames)).sort();

console.log('\n=== SCREEN COMPONENTS FOUND ===', uniqueScreenComponents.length);

// Check if any screen component is NOT in registeredStackScreens or registeredTabScreens
const unregisteredScreens = [];
uniqueScreenComponents.forEach(s => {
    // Some are named with Screen suffix, e.g. LoginScreen -> Login
    const stripped = s.replace(/Screen$/, '');
    if (!registeredStackScreens.has(s) && !registeredStackScreens.has(stripped) &&
        !registeredTabScreens.has(s) && !registeredTabScreens.has(stripped)) {
        unregisteredScreens.push(s);
    }
});
console.log('\n=== UNREGISTERED SCREEN COMPONENTS ===');
console.log(unregisteredScreens);

// 3. Scan for navigation.navigate calls
const navigationCalls = [];
const navigateRegex = /navigation\.(navigate|push|replace)\(\s*['"]([^'"]+)['"]/g;
const navigateObjectRegex = /navigation\.(navigate|push|replace)\(\s*{\s*name:\s*['"]([^'"]+)['"]/g;

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(srcDir, file);
    let m;
    while ((m = navigateRegex.exec(content)) !== null) {
        navigationCalls.push({ file: relPath, action: m[1], route: m[2] });
    }
    while ((m = navigateObjectRegex.exec(content)) !== null) {
        navigationCalls.push({ file: relPath, action: m[1], route: m[2] });
    }
});

const referencedRoutes = Array.from(new Set(navigationCalls.map(c => c.route))).sort();
console.log('\n=== REFERENCED ROUTES IN CODE ===', referencedRoutes.length);

const allRegistered = new Set([...registeredStackScreens, ...registeredTabScreens, 'Auth', 'Main', 'Tabs']);
const missingRoutes = [];
referencedRoutes.forEach(r => {
    if (!allRegistered.has(r)) {
        missingRoutes.push(r);
    }
});
console.log('\n=== REFERENCED BUT UNREGISTERED ROUTES ===');
missingRoutes.forEach(r => {
    const callers = navigationCalls.filter(c => c.route === r).map(c => `${c.file} (${c.action})`);
    console.log(`- ${r}: called from ${callers.join(', ')}`);
});

// 4. Scan for interactive buttons & handlers
const interactiveRegex = /<(TouchableOpacity|Pressable|AntigravityButton|Button)\b([^>]*?)(\/?>)/gs;
const deadButtons = [];
const allButtons = [];

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(srcDir, file);
    let m;
    while ((m = interactiveRegex.exec(content)) !== null) {
        const tag = m[1];
        const props = m[2];
        const isSelfClosing = m[3].includes('/');

        let onPressMatch = props.match(/onPress={([^}]+)}/s);
        let titleMatch = props.match(/title=["']([^"']+)["']/);
        let labelMatch = props.match(/accessibilityLabel=["']([^"']+)["']/);
        
        let handler = onPressMatch ? onPressMatch[1].trim() : (props.includes('onPress') ? 'complex' : 'NONE');
        let label = (titleMatch && titleMatch[1]) || (labelMatch && labelMatch[1]) || 'unlabeled';

        let status = 'PASS';
        if (handler === 'NONE') {
            status = 'MISSING HANDLER';
        } else if (handler === '() => {}' || handler === '() => { }' || handler === '{() => {}}' || handler === 'undefined') {
            status = 'NO-OP';
        } else if (handler.includes('console.log') && !handler.includes('navigate') && !handler.includes('set') && !handler.includes('dispatch')) {
            status = 'NO-OP (CONSOLE ONLY)';
        }

        const item = {
            file: relPath,
            tag,
            label,
            handler: handler.replace(/\s+/g, ' ').slice(0, 60),
            status
        };

        allButtons.push(item);
        if (status !== 'PASS') {
            deadButtons.push(item);
        }
    }
});

console.log(`\n=== INTERACTIVE CONTROLS SCANNED: ${allButtons.length} ===`);
console.log(`Dead / Missing / No-op buttons found: ${deadButtons.length}`);
deadButtons.forEach(b => {
    console.log(`[${b.status}] ${b.file} <${b.tag}> label="${b.label}" handler="${b.handler}"`);
});
