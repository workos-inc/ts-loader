"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const typescript = require("typescript");
const constants = require("./constants");
/**
 * Take TypeScript errors, parse them and format to webpack errors
 * Optionally adds a file name
 */
function formatErrors(_diagnostics, _loaderOptions, _colors, _compiler, _merge, _context) {
    // don't report any errors. typescript errors will be handled by ForkTsCheckerWebpackPlugin
    return [];
}
exports.formatErrors = formatErrors;
function readFile(fileName, encoding = 'utf8') {
    fileName = path.normalize(fileName);
    try {
        return fs.readFileSync(fileName, encoding);
    }
    catch (e) {
        return undefined;
    }
}
exports.readFile = readFile;
function makeError(message, file, location) {
    return {
        message,
        location,
        file,
        loaderSource: 'ts-loader'
    };
}
exports.makeError = makeError;
function fileMatchesPatterns(patterns, file) {
    for (const regexp of patterns) {
        if (file.match(regexp) !== null) {
            return true;
        }
    }
    return false;
}
exports.fileMatchesPatterns = fileMatchesPatterns;
function appendSuffixIfMatch(patterns, filePath, suffix) {
    if (patterns.length > 0) {
        for (const regexp of patterns) {
            if (filePath.match(regexp) !== null) {
                return filePath + suffix;
            }
        }
    }
    return filePath;
}
exports.appendSuffixIfMatch = appendSuffixIfMatch;
function appendSuffixesIfMatch(suffixDict, filePath) {
    let amendedPath = filePath;
    for (const suffix in suffixDict) {
        amendedPath = appendSuffixIfMatch(suffixDict[suffix], amendedPath, suffix);
    }
    return amendedPath;
}
exports.appendSuffixesIfMatch = appendSuffixesIfMatch;
function unorderedRemoveItem(array, item) {
    for (let i = 0; i < array.length; i++) {
        if (array[i] === item) {
            // Fill in the "hole" left at `index`.
            array[i] = array[array.length - 1];
            array.pop();
            return true;
        }
    }
    return false;
}
exports.unorderedRemoveItem = unorderedRemoveItem;
/**
 * Recursively collect all possible dependants of passed file
 */
function collectAllDependants(reverseDependencyGraph, fileName, collected = {}) {
    const result = {};
    result[fileName] = true;
    collected[fileName] = true;
    const dependants = reverseDependencyGraph[fileName];
    if (dependants !== undefined) {
        Object.keys(dependants).forEach(dependantFileName => {
            if (!collected[dependantFileName]) {
                collectAllDependants(reverseDependencyGraph, dependantFileName, collected).forEach(fName => (result[fName] = true));
            }
        });
    }
    return Object.keys(result);
}
exports.collectAllDependants = collectAllDependants;
/**
 * Recursively collect all possible dependencies of passed file
 */
function collectAllDependencies(dependencyGraph, filePath, collected = {}) {
    const result = {};
    result[filePath] = true;
    collected[filePath] = true;
    const directDependencies = dependencyGraph[filePath];
    if (directDependencies !== undefined) {
        directDependencies.forEach(dependencyModule => {
            if (!collected[dependencyModule.originalFileName]) {
                collectAllDependencies(dependencyGraph, dependencyModule.resolvedFileName, collected).forEach(depFilePath => (result[depFilePath] = true));
            }
        });
    }
    return Object.keys(result);
}
exports.collectAllDependencies = collectAllDependencies;
function arrify(val) {
    if (val === null || val === undefined) {
        return [];
    }
    return Array.isArray(val) ? val : [val];
}
exports.arrify = arrify;
function ensureProgram(instance) {
    if (instance && instance.watchHost) {
        if (instance.hasUnaccountedModifiedFiles) {
            if (instance.changedFilesList) {
                instance.watchHost.updateRootFileNames();
            }
            if (instance.watchOfFilesAndCompilerOptions) {
                instance.builderProgram = instance.watchOfFilesAndCompilerOptions.getProgram();
                instance.program = instance.builderProgram.getProgram();
            }
            instance.hasUnaccountedModifiedFiles = false;
        }
        return instance.program;
    }
    if (instance.languageService) {
        return instance.languageService.getProgram();
    }
    return instance.program;
}
exports.ensureProgram = ensureProgram;
function supportsProjectReferences(instance) {
    const program = ensureProgram(instance);
    return program && !!program.getProjectReferences;
}
exports.supportsProjectReferences = supportsProjectReferences;
function isUsingProjectReferences(instance) {
    if (instance.loaderOptions.projectReferences &&
        supportsProjectReferences(instance)) {
        const program = ensureProgram(instance);
        return Boolean(program && program.getProjectReferences());
    }
    return false;
}
exports.isUsingProjectReferences = isUsingProjectReferences;
/**
 * Gets the project reference for a file from the cache if it exists,
 * or gets it from TypeScript and caches it otherwise.
 */
function getAndCacheProjectReference(filePath, instance) {
    // When using solution builder, dont do the project reference caching
    if (instance.solutionBuilderHost) {
        return undefined;
    }
    const file = instance.files.get(filePath);
    if (file !== undefined && file.projectReference) {
        return file.projectReference.project;
    }
    const projectReference = getProjectReferenceForFile(filePath, instance);
    if (file !== undefined) {
        file.projectReference = { project: projectReference };
    }
    return projectReference;
}
exports.getAndCacheProjectReference = getAndCacheProjectReference;
function getResolvedProjectReferences(program) {
    const getProjectReferences = program.getResolvedProjectReferences ||
        program.getProjectReferences;
    if (getProjectReferences) {
        return getProjectReferences();
    }
    return;
}
function getProjectReferenceForFile(filePath, instance) {
    if (isUsingProjectReferences(instance)) {
        const program = ensureProgram(instance);
        return (program &&
            getResolvedProjectReferences(program).find(ref => (ref &&
                ref.commandLine.fileNames.some(file => path.normalize(file) === filePath)) ||
                false));
    }
    return;
}
function validateSourceMapOncePerProject(instance, loader, jsFileName, project) {
    const { projectsMissingSourceMaps = new Set() } = instance;
    if (!projectsMissingSourceMaps.has(project.sourceFile.fileName)) {
        instance.projectsMissingSourceMaps = projectsMissingSourceMaps;
        projectsMissingSourceMaps.add(project.sourceFile.fileName);
        const mapFileName = jsFileName + '.map';
        if (!instance.compiler.sys.fileExists(mapFileName)) {
            const [relativeJSPath, relativeProjectConfigPath] = [
                path.relative(loader.rootContext, jsFileName),
                path.relative(loader.rootContext, project.sourceFile.fileName)
            ];
            loader.emitWarning(new Error('Could not find source map file for referenced project output ' +
                `${relativeJSPath}. Ensure the 'sourceMap' compiler option ` +
                `is enabled in ${relativeProjectConfigPath} to ensure Webpack ` +
                'can map project references to the appropriate source files.'));
        }
    }
}
exports.validateSourceMapOncePerProject = validateSourceMapOncePerProject;
function supportsSolutionBuild(instance) {
    return (!!instance.configFilePath &&
        !!instance.loaderOptions.projectReferences &&
        !!instance.compiler.InvalidatedProjectKind &&
        !!instance.configParseResult.projectReferences &&
        !!instance.configParseResult.projectReferences.length);
}
exports.supportsSolutionBuild = supportsSolutionBuild;
/**
 * Gets the output JS file path for an input file governed by a composite project.
 * Pulls from the cache if it exists; computes and caches the result otherwise.
 */
function getAndCacheOutputJSFileName(inputFileName, projectReference, instance) {
    const file = instance.files.get(inputFileName);
    if (file && file.projectReference && file.projectReference.outputFileName) {
        return file.projectReference.outputFileName;
    }
    const outputFileName = getOutputJavaScriptFileName(inputFileName, projectReference);
    if (file !== undefined) {
        file.projectReference = file.projectReference || {
            project: projectReference
        };
        file.projectReference.outputFileName = outputFileName;
    }
    return outputFileName;
}
exports.getAndCacheOutputJSFileName = getAndCacheOutputJSFileName;
// Adapted from https://github.com/Microsoft/TypeScript/blob/45101491c0b077c509b25830ef0ee5f85b293754/src/compiler/tsbuild.ts#L305
function getOutputJavaScriptFileName(inputFileName, projectReference) {
    const { options } = projectReference.commandLine;
    const projectDirectory = options.rootDir || path.dirname(projectReference.sourceFile.fileName);
    const relativePath = path.relative(projectDirectory, inputFileName);
    const outputPath = path.resolve(options.outDir || projectDirectory, relativePath);
    const newExtension = constants.jsonRegex.test(inputFileName)
        ? '.json'
        : constants.tsxRegex.test(inputFileName) &&
            options.jsx === typescript.JsxEmit.Preserve
            ? '.jsx'
            : '.js';
    return outputPath.replace(constants.extensionRegex, newExtension);
}
//# sourceMappingURL=utils.js.map