const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

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

// Collect all registered routes
const appNavFile = path.join(srcDir, 'navigation/AppNavigator.js');
const tabNavFile = path.join(srcDir, 'navigation/PropertyTabNavigator.js');

const registeredStackRoutes = new Set();
const registeredAuthRoutes = new Set();
const registeredTabRoutes = new Set(['Explore', 'Saved', 'Post', 'Areas', 'Profile']);

function parseFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    try {
        return parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
    } catch (e) {
        console.error(`Failed to parse ${filePath}:`, e.message);
        return null;
    }
}

// 1. Inspect AppNavigator.js
const appAst = parseFile(appNavFile);
traverse(appAst, {
    JSXOpeningElement(p) {
        const name = p.node.name.name || (p.node.name.property && p.node.name.property.name);
        if (name === 'Screen') {
            const nameAttr = p.node.attributes.find(a => a.name && a.name.name === 'name');
            if (nameAttr && nameAttr.value && nameAttr.value.value) {
                const screenName = nameAttr.value.value;
                // Check if inside AuthNavigator or MainNavigator
                registeredStackRoutes.add(screenName);
            }
        }
    }
});

console.log('Total Stack Screens registered in AppNavigator:', registeredStackRoutes.size);
console.log(Array.from(registeredStackRoutes).sort());

// 2. Scan all navigation calls across all files
const navigationCalls = [];
const allInteractiveElements = [];

allFiles.forEach(filePath => {
    const relPath = path.relative(srcDir, filePath);
    const ast = parseFile(filePath);
    if (!ast) return;

    traverse(ast, {
        CallExpression(p) {
            const callee = p.node.callee;
            if (
                callee.type === 'MemberExpression' &&
                (callee.object.name === 'navigation' || (callee.object.property && callee.object.property.name === 'navigation')) &&
                ['navigate', 'push', 'replace'].includes(callee.property.name)
            ) {
                const action = callee.property.name;
                const arg0 = p.node.arguments[0];
                const arg1 = p.node.arguments[1];
                let target = null;
                let nestedScreen = null;

                if (arg0) {
                    if (arg0.type === 'StringLiteral') {
                        target = arg0.value;
                    } else if (arg0.type === 'ObjectExpression') {
                        const nameProp = arg0.properties.find(prop => prop.key && prop.key.name === 'name');
                        if (nameProp && nameProp.value.type === 'StringLiteral') {
                            target = nameProp.value.value;
                        }
                    }
                }

                if (arg1 && arg1.type === 'ObjectExpression') {
                    const screenProp = arg1.properties.find(prop => prop.key && prop.key.name === 'screen');
                    if (screenProp && screenProp.value.type === 'StringLiteral') {
                        nestedScreen = screenProp.value.value;
                    }
                }

                if (target) {
                    navigationCalls.push({
                        file: relPath,
                        line: p.node.loc?.start.line,
                        action,
                        target,
                        nestedScreen
                    });
                }
            }
        },

        JSXOpeningElement(p) {
            const tag = p.node.name.name;
            if (['TouchableOpacity', 'Pressable', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Button', 'AntigravityButton'].includes(tag)) {
                const onPressAttr = p.node.attributes.find(a => a.name && a.name.name === 'onPress');
                const titleAttr = p.node.attributes.find(a => a.name && a.name.name === 'title');
                const labelAttr = p.node.attributes.find(a => a.name && a.name.name === 'accessibilityLabel');
                const disabledAttr = p.node.attributes.find(a => a.name && a.name.name === 'disabled');

                let title = null;
                if (titleAttr) {
                    if (titleAttr.value.type === 'StringLiteral') title = titleAttr.value.value;
                    else title = '[dynamic title]';
                }
                let label = null;
                if (labelAttr) {
                    if (labelAttr.value.type === 'StringLiteral') label = labelAttr.value.value;
                    else label = '[dynamic label]';
                }

                let status = 'PASS';
                let handlerType = 'HANDLER_EXISTS';

                if (!onPressAttr) {
                    // Check if disabled or if parent handles it
                    status = disabledAttr ? 'DISABLED_NO_ONPRESS' : 'MISSING_ONPRESS';
                    handlerType = 'NONE';
                } else {
                    const val = onPressAttr.value;
                    if (!val) {
                        status = 'EMPTY_ONPRESS';
                        handlerType = 'EMPTY';
                    } else if (val.type === 'JSXExpressionContainer') {
                        const expr = val.expression;
                        if (expr.type === 'Identifier' && expr.name === 'undefined') {
                            status = 'UNDEFINED_HANDLER';
                            handlerType = 'UNDEFINED';
                        } else if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
                            const body = expr.body;
                            if (body.type === 'BlockStatement') {
                                if (body.body.length === 0) {
                                    status = 'NO-OP_EMPTY_FUNCTION';
                                    handlerType = 'NO-OP';
                                } else if (body.body.length === 1 && body.body[0].type === 'ExpressionStatement') {
                                    const exp = body.body[0].expression;
                                    if (
                                        exp.type === 'CallExpression' &&
                                        exp.callee.type === 'MemberExpression' &&
                                        exp.callee.object.name === 'console'
                                    ) {
                                        status = 'NO-OP_CONSOLE_ONLY';
                                        handlerType = 'CONSOLE_LOG';
                                    }
                                }
                            }
                        }
                    }
                }

                allInteractiveElements.push({
                    file: relPath,
                    line: p.node.loc?.start.line,
                    tag,
                    label: title || label || '[no label]',
                    status,
                    handlerType
                });
            }
        }
    });
});

console.log('\n=== TOTAL NAVIGATION CALLS ANALYZED ===', navigationCalls.length);

// Verify all navigation destinations
const allKnownDestinations = new Set([
    ...registeredStackRoutes,
    ...registeredTabRoutes,
    'Tabs',
    'Auth',
    'Main',
    'Blocked'
]);

const invalidNavigationCalls = [];
navigationCalls.forEach(c => {
    let valid = false;
    if (allKnownDestinations.has(c.target)) {
        valid = true;
    }
    // If target is Tabs, check nestedScreen
    if (c.target === 'Tabs' && c.nestedScreen) {
        if (!registeredTabRoutes.has(c.nestedScreen)) {
            valid = false;
        }
    }
    // If target is Auth, check nestedScreen
    if (c.target === 'Auth' && c.nestedScreen) {
        if (!['Login', 'Signup', 'ForgotPassword', 'LegalPolicy'].includes(c.nestedScreen)) {
            valid = false;
        }
    }

    if (!valid) {
        invalidNavigationCalls.push(c);
    }
});

console.log('\n=== INVALID / UNREGISTERED NAVIGATION TARGETS ===', invalidNavigationCalls.length);
invalidNavigationCalls.forEach(c => {
    console.log(`- ${c.file}:${c.line} -> action: ${c.action}, target: "${c.target}" (nested: "${c.nestedScreen}")`);
});

console.log('\n=== TOTAL INTERACTIVE ELEMENTS ANALYZED ===', allInteractiveElements.length);
const problemElements = allInteractiveElements.filter(el => el.status !== 'PASS' && el.status !== 'DISABLED_NO_ONPRESS');
console.log('Problem Elements found:', problemElements.length);
problemElements.forEach(el => {
    console.log(`- [${el.status}] ${el.file}:${el.line} <${el.tag}> label="${el.label}"`);
});

fs.writeFileSync(
    path.resolve(__dirname, 'astAuditResults.json'),
    JSON.stringify({ navigationCalls, invalidNavigationCalls, allInteractiveElements, problemElements }, null, 2)
);
console.log('\nWrote full audit results to scripts/astAuditResults.json');
