/**
 * @codebit-programando-solucoes/codemirror-spell-checker v1.1.5
 * Copyright Next Step Webs, Inc.
 * @link https://github.com/NextStepWebs/codemirror-spell-checker
 * @license MIT
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.CodeMirrorSpellChecker = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (__dirname){(function (){
/* globals chrome: false */
/* globals __dirname: false */
/* globals require: false */
/* globals Buffer: false */
/* globals module: false */
/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style
 * dictionaries.
 */
var Typo;
(function () {
    "use strict";
    /**
     * Typo constructor.
     *
     * @param {string} [dictionary] The locale code of the dictionary being used. e.g.,
     *                              "en_US". This is only used to auto-load dictionaries.
     * @param {string} [affData]    The data from the dictionary's .aff file. If omitted
     *                              and Typo.js is being used in a Chrome extension, the .aff
     *                              file will be loaded automatically from
     *                              lib/typo/dictionaries/[dictionary]/[dictionary].aff
     *                              In other environments, it will be loaded from
     *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].aff
     * @param {string} [wordsData]  The data from the dictionary's .dic file. If omitted
     *                              and Typo.js is being used in a Chrome extension, the .dic
     *                              file will be loaded automatically from
     *                              lib/typo/dictionaries/[dictionary]/[dictionary].dic
     *                              In other environments, it will be loaded from
     *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].dic
     * @param {Object} [settings]   Constructor settings. Available properties are:
     *                              {string} [dictionaryPath]: path to load dictionary from in non-chrome
     *                              environment.
     *                              {Object} [flags]: flag information.
     *                              {boolean} [asyncLoad]: If true, affData and wordsData will be loaded
     *                              asynchronously.
     *                              {Function} [loadedCallback]: Called when both affData and wordsData
     *                              have been loaded. Only used if asyncLoad is set to true. The parameter
     *                              is the instantiated Typo object.
     *
     * @returns {Typo} A Typo object.
     */
    Typo = function (dictionary, affData, wordsData, settings) {
        settings = settings || {};
        this.dictionary = null;
        this.rules = {};
        this.dictionaryTable = {};
        this.compoundRules = [];
        this.compoundRuleCodes = {};
        this.replacementTable = [];
        this.flags = settings.flags || {};
        this.memoized = {};
        this.loaded = false;
        var self = this;
        var path;
        // Loop-control variables.
        var i, j, _len, _jlen;
        if (dictionary) {
            self.dictionary = dictionary;
            // If the data is preloaded, just setup the Typo object.
            if (affData && wordsData) {
                setup();
            }
            // Loading data for Chrome extentions.
            else if (typeof window !== 'undefined' && (window.chrome || window.browser)) {
                var runtime = window.chrome && window.chrome.runtime ? window.chrome.runtime : browser.runtime;
                if (settings.dictionaryPath) {
                    path = settings.dictionaryPath;
                }
                else {
                    path = "typo/dictionaries";
                }
                if (!affData)
                    readDataFile(runtime.getURL(path + "/" + dictionary + "/" + dictionary + ".aff"), setAffData);
                if (!wordsData)
                    readDataFile(runtime.getURL(path + "/" + dictionary + "/" + dictionary + ".dic"), setWordsData);
            }
            // Loading data for Node.js or other environments.
            else {
                if (settings.dictionaryPath) {
                    path = settings.dictionaryPath;
                }
                else if (typeof __dirname !== 'undefined') {
                    path = __dirname + '/dictionaries';
                }
                else {
                    path = './dictionaries';
                }
                if (!affData)
                    readDataFile(path + "/" + dictionary + "/" + dictionary + ".aff", setAffData);
                if (!wordsData)
                    readDataFile(path + "/" + dictionary + "/" + dictionary + ".dic", setWordsData);
            }
        }
        function readDataFile(url, setFunc) {
            var response = self._readFile(url, null, settings === null || settings === void 0 ? void 0 : settings.asyncLoad);
            if (settings === null || settings === void 0 ? void 0 : settings.asyncLoad) {
                response.then(function (data) {
                    setFunc(data);
                });
            }
            else {
                setFunc(response);
            }
        }
        function setAffData(data) {
            affData = data;
            if (wordsData) {
                setup();
            }
        }
        function setWordsData(data) {
            wordsData = data;
            if (affData) {
                setup();
            }
        }
        function setup() {
            self.rules = self._parseAFF(affData);
            // Save the rule codes that are used in compound rules.
            self.compoundRuleCodes = {};
            for (i = 0, _len = self.compoundRules.length; i < _len; i++) {
                var rule = self.compoundRules[i];
                for (j = 0, _jlen = rule.length; j < _jlen; j++) {
                    self.compoundRuleCodes[rule[j]] = [];
                }
            }
            // If we add this ONLYINCOMPOUND flag to self.compoundRuleCodes, then _parseDIC
            // will do the work of saving the list of words that are compound-only.
            if ("ONLYINCOMPOUND" in self.flags) {
                self.compoundRuleCodes[self.flags.ONLYINCOMPOUND] = [];
            }
            self.dictionaryTable = self._parseDIC(wordsData);
            // Get rid of any codes from the compound rule codes that are never used
            // (or that were special regex characters).  Not especially necessary...
            for (i in self.compoundRuleCodes) {
                if (self.compoundRuleCodes[i].length === 0) {
                    delete self.compoundRuleCodes[i];
                }
            }
            // Build the full regular expressions for each compound rule.
            // I have a feeling (but no confirmation yet) that this method of
            // testing for compound words is probably slow.
            for (i = 0, _len = self.compoundRules.length; i < _len; i++) {
                var ruleText = self.compoundRules[i];
                var expressionText = "";
                for (j = 0, _jlen = ruleText.length; j < _jlen; j++) {
                    var character = ruleText[j];
                    if (character in self.compoundRuleCodes) {
                        expressionText += "(" + self.compoundRuleCodes[character].join("|") + ")";
                    }
                    else {
                        expressionText += character;
                    }
                }
                self.compoundRules[i] = new RegExp('^' + expressionText + '$', "i");
            }
            self.loaded = true;
            if ((settings === null || settings === void 0 ? void 0 : settings.asyncLoad) && (settings === null || settings === void 0 ? void 0 : settings.loadedCallback)) {
                settings.loadedCallback(self);
            }
        }
        return this;
    };
    Typo.prototype = {
        /**
         * Loads a Typo instance from a hash of all of the Typo properties.
         *
         * @param {object} obj A hash of Typo properties, probably gotten from a JSON.parse(JSON.stringify(typo_instance)).
         */
        load: function (obj) {
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    this[i] = obj[i];
                }
            }
            return this;
        },
        /**
         * Read the contents of a file.
         *
         * @param {string} path The path (relative) to the file.
         * @param {string} [charset="ISO8859-1"] The expected charset of the file
         * @param {boolean} async If true, the file will be read asynchronously. For node.js this does nothing, all
         *        files are read synchronously.
         * @returns {string} The file data if async is false, otherwise a promise object. If running node.js, the data is
         *          always returned.
         */
        _readFile: function (path, charset, async) {
            var _a;
            charset = charset || "utf8";
            if (typeof XMLHttpRequest !== 'undefined') {
                var req_1 = new XMLHttpRequest();
                req_1.open("GET", path, !!async);
                (_a = req_1.overrideMimeType) === null || _a === void 0 ? void 0 : _a.call(req_1, "text/plain; charset=" + charset);
                if (!!async) {
                    var promise = new Promise(function (resolve, reject) {
                        req_1.onload = function () {
                            if (req_1.status === 200) {
                                resolve(req_1.responseText);
                            }
                            else {
                                reject(req_1.statusText);
                            }
                        };
                        req_1.onerror = function () {
                            reject(req_1.statusText);
                        };
                    });
                    req_1.send(null);
                    return promise;
                }
                else {
                    req_1.send(null);
                    return req_1.responseText;
                }
            }
            else if (typeof require !== 'undefined') {
                // Node.js
                var fs = require("fs");
                try {
                    if (fs.existsSync(path)) {
                        return fs.readFileSync(path, charset);
                    }
                    else {
                        console.log("Path " + path + " does not exist.");
                    }
                }
                catch (e) {
                    console.log(e);
                }
                return '';
            }
            return '';
        },
        /**
         * Parse the rules out from a .aff file.
         *
         * @param {string} data The contents of the affix file.
         * @returns object The rules from the file.
         */
        _parseAFF: function (data) {
            var rules = {};
            var line, subline, numEntries, lineParts;
            var i, j, _len, _jlen;
            var lines = data.split(/\r?\n/);
            for (i = 0, _len = lines.length; i < _len; i++) {
                // Remove comment lines
                line = this._removeAffixComments(lines[i]);
                line = line.trim();
                if (!line) {
                    continue;
                }
                var definitionParts = line.split(/\s+/);
                var ruleType = definitionParts[0];
                if (ruleType === "PFX" || ruleType === "SFX") {
                    var ruleCode = definitionParts[1];
                    var combineable = definitionParts[2];
                    numEntries = parseInt(definitionParts[3], 10);
                    var entries = [];
                    for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
                        subline = lines[j];
                        lineParts = subline.split(/\s+/);
                        var charactersToRemove = lineParts[2];
                        var additionParts = lineParts[3].split("/");
                        var charactersToAdd = additionParts[0];
                        if (charactersToAdd === "0")
                            charactersToAdd = "";
                        var continuationClasses = this.parseRuleCodes(additionParts[1]);
                        var regexToMatch = lineParts[4];
                        var entry = {
                            add: charactersToAdd
                        };
                        if (continuationClasses.length > 0)
                            entry.continuationClasses = continuationClasses;
                        if (regexToMatch !== ".") {
                            if (ruleType === "SFX") {
                                entry.match = new RegExp(regexToMatch + "$");
                            }
                            else {
                                entry.match = new RegExp("^" + regexToMatch);
                            }
                        }
                        if (charactersToRemove != "0") {
                            if (ruleType === "SFX") {
                                entry.remove = new RegExp(charactersToRemove + "$");
                            }
                            else {
                                entry.remove = charactersToRemove;
                            }
                        }
                        entries.push(entry);
                    }
                    rules[ruleCode] = { "type": ruleType, "combineable": (combineable === "Y"), "entries": entries };
                    i += numEntries;
                }
                else if (ruleType === "COMPOUNDRULE") {
                    numEntries = parseInt(definitionParts[1], 10);
                    for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
                        line = lines[j];
                        lineParts = line.split(/\s+/);
                        this.compoundRules.push(lineParts[1]);
                    }
                    i += numEntries;
                }
                else if (ruleType === "REP") {
                    lineParts = line.split(/\s+/);
                    if (lineParts.length === 3) {
                        this.replacementTable.push([lineParts[1], lineParts[2]]);
                    }
                }
                else {
                    // ONLYINCOMPOUND
                    // COMPOUNDMIN
                    // FLAG
                    // KEEPCASE
                    // NEEDAFFIX
                    this.flags[ruleType] = definitionParts[1];
                }
            }
            return rules;
        },
        /**
         * Removes comments.
         *
         * @param {string} data A line from an affix file.
         * @return {string} The cleaned-up line.
         */
        _removeAffixComments: function (line) {
            // This used to remove any string starting with '#' up to the end of the line,
            // but some COMPOUNDRULE definitions include '#' as part of the rule.
            // So, only remove lines that begin with a comment, optionally preceded by whitespace.
            if (line.match(/^\s*#/)) {
                return '';
            }
            return line;
        },
        /**
         * Parses the words out from the .dic file.
         *
         * @param {string} data The data from the dictionary file.
         * @returns HashMap The lookup table containing all of the words and
         *                 word forms from the dictionary.
         */
        _parseDIC: function (data) {
            data = this._removeDicComments(data);
            var lines = data.split(/\r?\n/);
            var dictionaryTable = {};
            function addWord(word, rules) {
                // Some dictionaries will list the same word multiple times with different rule sets.
                if (!dictionaryTable.hasOwnProperty(word)) {
                    dictionaryTable[word] = null;
                }
                if (rules.length > 0) {
                    if (dictionaryTable[word] === null) {
                        dictionaryTable[word] = [];
                    }
                    dictionaryTable[word].push(rules);
                }
            }
            // The first line is the number of words in the dictionary.
            for (var i = 1, _len = lines.length; i < _len; i++) {
                var line = lines[i];
                if (!line) {
                    // Ignore empty lines.
                    continue;
                }
                var parts = line.split("/", 2);
                var word = parts[0];
                // Now for each affix rule, generate that form of the word.
                if (parts.length > 1) {
                    var ruleCodesArray = this.parseRuleCodes(parts[1]);
                    // Save the ruleCodes for compound word situations.
                    if (!("NEEDAFFIX" in this.flags) || ruleCodesArray.indexOf(this.flags.NEEDAFFIX) === -1) {
                        addWord(word, ruleCodesArray);
                    }
                    for (var j = 0, _jlen = ruleCodesArray.length; j < _jlen; j++) {
                        var code = ruleCodesArray[j];
                        var rule = this.rules[code];
                        if (rule) {
                            var newWords = this._applyRule(word, rule);
                            for (var ii = 0, _iilen = newWords.length; ii < _iilen; ii++) {
                                var newWord = newWords[ii];
                                addWord(newWord, []);
                                if (rule.combineable) {
                                    for (var k = j + 1; k < _jlen; k++) {
                                        var combineCode = ruleCodesArray[k];
                                        var combineRule = this.rules[combineCode];
                                        if (combineRule) {
                                            if (combineRule.combineable && (rule.type != combineRule.type)) {
                                                var otherNewWords = this._applyRule(newWord, combineRule);
                                                for (var iii = 0, _iiilen = otherNewWords.length; iii < _iiilen; iii++) {
                                                    var otherNewWord = otherNewWords[iii];
                                                    addWord(otherNewWord, []);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (code in this.compoundRuleCodes) {
                            this.compoundRuleCodes[code].push(word);
                        }
                    }
                }
                else {
                    addWord(word.trim(), []);
                }
            }
            return dictionaryTable;
        },
        /**
         * Removes comment lines and then cleans up blank lines and trailing whitespace.
         *
         * @param {string} data The data from a .dic file.
         * @return {string} The cleaned-up data.
         */
        _removeDicComments: function (data) {
            // I can't find any official documentation on it, but at least the de_DE
            // dictionary uses tab-indented lines as comments.
            // Remove comments
            data = data.replace(/^\t.*$/mg, "");
            return data;
        },
        parseRuleCodes: function (textCodes) {
            if (!textCodes) {
                return [];
            }
            else if (!("FLAG" in this.flags)) {
                // The flag symbols are single characters
                return textCodes.split("");
            }
            else if (this.flags.FLAG === "long") {
                // The flag symbols are two characters long.
                var flags = [];
                for (var i = 0, _len = textCodes.length; i < _len; i += 2) {
                    flags.push(textCodes.substr(i, 2));
                }
                return flags;
            }
            else if (this.flags.FLAG === "num") {
                // The flag symbols are a CSV list of numbers.
                return textCodes.split(",");
            }
            else if (this.flags.FLAG === "UTF-8") {
                // The flags are single UTF-8 characters.
                // @see https://github.com/cfinke/Typo.js/issues/57
                return Array.from(textCodes);
            }
            else {
                // It's possible that this fallback case will not work for all FLAG values,
                // but I think it's more likely to work than not returning anything at all.
                return textCodes.split("");
            }
        },
        /**
         * Applies an affix rule to a word.
         *
         * @param {string} word The base word.
         * @param {Object} rule The affix rule.
         * @returns {string[]} The new words generated by the rule.
         */
        _applyRule: function (word, rule) {
            var entries = rule.entries;
            var newWords = [];
            for (var i = 0, _len = entries.length; i < _len; i++) {
                var entry = entries[i];
                if (!entry.match || word.match(entry.match)) {
                    var newWord = word;
                    if (entry.remove) {
                        newWord = newWord.replace(entry.remove, "");
                    }
                    if (rule.type === "SFX") {
                        newWord = newWord + entry.add;
                    }
                    else {
                        newWord = entry.add + newWord;
                    }
                    newWords.push(newWord);
                    if ("continuationClasses" in entry) {
                        for (var j = 0, _jlen = entry.continuationClasses.length; j < _jlen; j++) {
                            var continuationRule = this.rules[entry.continuationClasses[j]];
                            if (continuationRule) {
                                newWords = newWords.concat(this._applyRule(newWord, continuationRule));
                            }
                            /*
                            else {
                                // This shouldn't happen, but it does, at least in the de_DE dictionary.
                                // I think the author mistakenly supplied lower-case rule codes instead
                                // of upper-case.
                            }
                            */
                        }
                    }
                }
            }
            return newWords;
        },
        /**
         * Checks whether a word or a capitalization variant exists in the current dictionary.
         * The word is trimmed and several variations of capitalizations are checked.
         * If you want to check a word without any changes made to it, call checkExact()
         *
         * @see http://blog.stevenlevithan.com/archives/faster-trim-javascript re:trimming function
         *
         * @param {string} aWord The word to check.
         * @returns {boolean}
         */
        check: function (aWord) {
            if (!this.loaded) {
                throw "Dictionary not loaded.";
            }
            if (!aWord) {
                return false;
            }
            // Remove leading and trailing whitespace
            var trimmedWord = aWord.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
            if (this.checkExact(trimmedWord)) {
                return true;
            }
            // The exact word is not in the dictionary.
            if (trimmedWord.toUpperCase() === trimmedWord) {
                // The word was supplied in all uppercase.
                // Check for a capitalized form of the word.
                var capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();
                if (this.hasFlag(capitalizedWord, "KEEPCASE")) {
                    // Capitalization variants are not allowed for this word.
                    return false;
                }
                if (this.checkExact(capitalizedWord)) {
                    // The all-caps word is a capitalized word spelled correctly.
                    return true;
                }
                if (this.checkExact(trimmedWord.toLowerCase())) {
                    // The all-caps is a lowercase word spelled correctly.
                    return true;
                }
            }
            var uncapitalizedWord = trimmedWord[0].toLowerCase() + trimmedWord.substring(1);
            if (uncapitalizedWord !== trimmedWord) {
                if (this.hasFlag(uncapitalizedWord, "KEEPCASE")) {
                    // Capitalization variants are not allowed for this word.
                    return false;
                }
                // Check for an uncapitalized form
                if (this.checkExact(uncapitalizedWord)) {
                    // The word is spelled correctly but with the first letter capitalized.
                    return true;
                }
            }
            return false;
        },
        /**
         * Checks whether a word exists in the current dictionary.
         *
         * @param {string} word The word to check.
         * @returns {boolean}
         */
        checkExact: function (word) {
            if (!this.loaded) {
                throw "Dictionary not loaded.";
            }
            var ruleCodes = this.dictionaryTable[word];
            var i, _len;
            if (typeof ruleCodes === 'undefined') {
                // Check if this might be a compound word.
                if ("COMPOUNDMIN" in this.flags && word.length >= this.flags.COMPOUNDMIN) {
                    for (i = 0, _len = this.compoundRules.length; i < _len; i++) {
                        if (word.match(this.compoundRules[i])) {
                            return true;
                        }
                    }
                }
            }
            else if (ruleCodes === null) {
                // a null (but not undefined) value for an entry in the dictionary table
                // means that the word is in the dictionary but has no flags.
                return true;
            }
            else if (typeof ruleCodes === 'object') { // this.dictionary['hasOwnProperty'] will be a function.
                for (i = 0, _len = ruleCodes.length; i < _len; i++) {
                    if (!this.hasFlag(word, "ONLYINCOMPOUND", ruleCodes[i])) {
                        return true;
                    }
                }
            }
            return false;
        },
        /**
         * Looks up whether a given word is flagged with a given flag.
         *
         * @param {string} word The word in question.
         * @param {string} flag The flag in question.
         * @return {boolean}
         */
        hasFlag: function (word, flag, wordFlags) {
            if (!this.loaded) {
                throw "Dictionary not loaded.";
            }
            if (flag in this.flags) {
                if (typeof wordFlags === 'undefined') {
                    wordFlags = Array.prototype.concat.apply([], this.dictionaryTable[word]);
                }
                if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
                    return true;
                }
            }
            return false;
        },
        /**
         * Returns a list of suggestions for a misspelled word.
         *
         * @see http://www.norvig.com/spell-correct.html for the basis of this suggestor.
         * This suggestor is primitive, but it works.
         *
         * @param {string} word The misspelling.
         * @param {number} [limit=5] The maximum number of suggestions to return.
         * @returns {string[]} The array of suggestions.
         */
        alphabet: "",
        suggest: function (word, limit) {
            if (!this.loaded) {
                throw "Dictionary not loaded.";
            }
            limit = limit || 5;
            if (this.memoized.hasOwnProperty(word)) {
                var memoizedLimit = this.memoized[word]['limit'];
                // Only return the cached list if it's big enough or if there weren't enough suggestions
                // to fill a smaller limit.
                if (limit <= memoizedLimit || this.memoized[word]['suggestions'].length < memoizedLimit) {
                    return this.memoized[word]['suggestions'].slice(0, limit);
                }
            }
            if (this.check(word))
                return [];
            // Check the replacement table.
            for (var i = 0, _len = this.replacementTable.length; i < _len; i++) {
                var replacementEntry = this.replacementTable[i];
                if (word.indexOf(replacementEntry[0]) !== -1) {
                    var correctedWord = word.replace(replacementEntry[0], replacementEntry[1]);
                    if (this.check(correctedWord)) {
                        return [correctedWord];
                    }
                }
            }
            if (!this.alphabet) {
                // Use the English alphabet as the default. Problematic, but backwards-compatible.
                this.alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
                // Any characters defined in the affix file as substitutions can go in the alphabet too.
                // Note that dictionaries do not include the entire alphabet in the TRY flag when it's there.
                // For example, Q is not in the default English TRY list; that's why having the default
                // alphabet above is useful.
                if ('TRY' in this.flags) {
                    this.alphabet += this.flags['TRY'];
                }
                // Plus any additional characters specifically defined as being allowed in words.
                if ('WORDCHARS' in this.flags) {
                    this.alphabet += this.flags['WORDCHARS'];
                }
                // Remove any duplicates.
                var alphaArray = this.alphabet.split("");
                alphaArray.sort();
                var alphaHash = {};
                for (var i = 0; i < alphaArray.length; i++) {
                    alphaHash[alphaArray[i]] = true;
                }
                this.alphabet = '';
                for (var i in alphaHash) {
                    this.alphabet += i;
                }
            }
            var self = this;
            /**
             * Returns a hash keyed by all of the strings that can be made by making a single edit to the word (or words in) `words`
             * The value of each entry is the number of unique ways that the resulting word can be made.
             *
             * @arg HashMap words A hash keyed by words (all with the value `true` to make lookups very quick).
             * @arg boolean known_only Whether this function should ignore strings that are not in the dictionary.
             */
            function edits1(words, known_only) {
                var rv = {};
                var i, j, _iilen, _len, _jlen, _edit;
                var alphabetLength = self.alphabet.length;
                for (var word_1 in words) {
                    for (i = 0, _len = word_1.length + 1; i < _len; i++) {
                        var s = [word_1.substring(0, i), word_1.substring(i)];
                        // Remove a letter.
                        if (s[1]) {
                            _edit = s[0] + s[1].substring(1);
                            if (!known_only || self.check(_edit)) {
                                if (!(_edit in rv)) {
                                    rv[_edit] = 1;
                                }
                                else {
                                    rv[_edit] += 1;
                                }
                            }
                        }
                        // Transpose letters
                        // Eliminate transpositions of identical letters
                        if (s[1].length > 1 && s[1][1] !== s[1][0]) {
                            _edit = s[0] + s[1][1] + s[1][0] + s[1].substring(2);
                            if (!known_only || self.check(_edit)) {
                                if (!(_edit in rv)) {
                                    rv[_edit] = 1;
                                }
                                else {
                                    rv[_edit] += 1;
                                }
                            }
                        }
                        if (s[1]) {
                            // Replace a letter with another letter.
                            var lettercase = (s[1].substring(0, 1).toUpperCase() === s[1].substring(0, 1)) ? 'uppercase' : 'lowercase';
                            for (j = 0; j < alphabetLength; j++) {
                                var replacementLetter = self.alphabet[j];
                                // Set the case of the replacement letter to the same as the letter being replaced.
                                if ('uppercase' === lettercase) {
                                    replacementLetter = replacementLetter.toUpperCase();
                                }
                                // Eliminate replacement of a letter by itself
                                if (replacementLetter != s[1].substring(0, 1)) {
                                    _edit = s[0] + replacementLetter + s[1].substring(1);
                                    if (!known_only || self.check(_edit)) {
                                        if (!(_edit in rv)) {
                                            rv[_edit] = 1;
                                        }
                                        else {
                                            rv[_edit] += 1;
                                        }
                                    }
                                }
                            }
                        }
                        if (s[1]) {
                            // Add a letter between each letter.
                            for (j = 0; j < alphabetLength; j++) {
                                // If the letters on each side are capitalized, capitalize the replacement.
                                var lettercase = (s[0].substring(-1).toUpperCase() === s[0].substring(-1) && s[1].substring(0, 1).toUpperCase() === s[1].substring(0, 1)) ? 'uppercase' : 'lowercase';
                                var replacementLetter = self.alphabet[j];
                                if ('uppercase' === lettercase) {
                                    replacementLetter = replacementLetter.toUpperCase();
                                }
                                _edit = s[0] + replacementLetter + s[1];
                                if (!known_only || self.check(_edit)) {
                                    if (!(_edit in rv)) {
                                        rv[_edit] = 1;
                                    }
                                    else {
                                        rv[_edit] += 1;
                                    }
                                }
                            }
                        }
                    }
                }
                return rv;
            }
            function correct(word) {
                var _a;
                // Get the edit-distance-1 and edit-distance-2 forms of this word.
                var ed1 = edits1((_a = {}, _a[word] = true, _a));
                var ed2 = edits1(ed1, true);
                // Sort the edits based on how many different ways they were created.
                var weighted_corrections = ed2;
                for (var ed1word in ed1) {
                    if (!self.check(ed1word)) {
                        continue;
                    }
                    if (ed1word in weighted_corrections) {
                        weighted_corrections[ed1word] += ed1[ed1word];
                    }
                    else {
                        weighted_corrections[ed1word] = ed1[ed1word];
                    }
                }
                var i, _len;
                var sorted_corrections = [];
                for (i in weighted_corrections) {
                    if (weighted_corrections.hasOwnProperty(i)) {
                        sorted_corrections.push([i, weighted_corrections[i]]);
                    }
                }
                function sorter(a, b) {
                    var a_val = a[1];
                    var b_val = b[1];
                    if (a_val < b_val) {
                        return -1;
                    }
                    else if (a_val > b_val) {
                        return 1;
                    }
                    // @todo If a and b are equally weighted, add our own weight based on something like the key locations on this language's default keyboard.
                    return b[0].localeCompare(a[0]);
                }
                sorted_corrections.sort(sorter).reverse();
                var rv = [];
                var capitalization_scheme = "lowercase";
                if (word.toUpperCase() === word) {
                    capitalization_scheme = "uppercase";
                }
                else if (word.substr(0, 1).toUpperCase() + word.substr(1).toLowerCase() === word) {
                    capitalization_scheme = "capitalized";
                }
                var working_limit = limit;
                for (i = 0; i < Math.min(working_limit, sorted_corrections.length); i++) {
                    if ("uppercase" === capitalization_scheme) {
                        sorted_corrections[i][0] = sorted_corrections[i][0].toUpperCase();
                    }
                    else if ("capitalized" === capitalization_scheme) {
                        sorted_corrections[i][0] = sorted_corrections[i][0].substr(0, 1).toUpperCase() + sorted_corrections[i][0].substr(1);
                    }
                    if (!self.hasFlag(sorted_corrections[i][0], "NOSUGGEST") && rv.indexOf(sorted_corrections[i][0]) === -1) {
                        rv.push(sorted_corrections[i][0]);
                    }
                    else {
                        // If one of the corrections is not eligible as a suggestion , make sure we still return the right number of suggestions.
                        working_limit++;
                    }
                }
                return rv;
            }
            this.memoized[word] = {
                'suggestions': correct(word),
                'limit': limit
            };
            return this.memoized[word]['suggestions'];
        }
    };
})();
// Support for use as a node.js module.
if (typeof module !== 'undefined') {
    module.exports = Typo;
}

}).call(this)}).call(this,"/node_modules/typo-js")

},{"fs":1}],3:[function(require,module,exports){
// Use strict mode (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
"use strict";


// Requires
var Typo = require("typo-js");


// Create function
function CodeMirrorSpellChecker(options) {
	// Initialize
	options = options || {};
	options.language = options.language || "en_US";
	options.urlAff = options.urlAff || "https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.aff";
	options.urlDic = options.urlDic || "https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.dic";


	// Verify
	if(typeof options.codeMirrorInstance !== "function" || typeof options.codeMirrorInstance.defineMode !== "function") {
		console.log("CodeMirror Spell Checker: You must provide an instance of CodeMirror via the option `codeMirrorInstance`");
		return;
	}


	// Because some browsers don't support this functionality yet
	if(!String.prototype.includes) {
		String.prototype.includes = function() {
			"use strict";
			return String.prototype.indexOf.apply(this, arguments) !== -1;
		};
	}


	// Define the new mode
	options.codeMirrorInstance.defineMode("spell-checker", function(config) {
		// Load AFF/DIC data
		if(!CodeMirrorSpellChecker.aff_loading) {
			CodeMirrorSpellChecker.aff_loading = true;
			var xhr_aff = new XMLHttpRequest();
			xhr_aff.open("GET", options.urlAff, true);
			xhr_aff.onload = function() {
				if(xhr_aff.readyState === 4 && xhr_aff.status === 200) {
					CodeMirrorSpellChecker.aff_data = xhr_aff.responseText;
					CodeMirrorSpellChecker.num_loaded++;

					if(CodeMirrorSpellChecker.num_loaded == 2) {
						CodeMirrorSpellChecker.typo = new Typo(options.language, CodeMirrorSpellChecker.aff_data, CodeMirrorSpellChecker.dic_data, {
							platform: "any"
						});
					}
				}
			};
			xhr_aff.send(null);
		}

		if(!CodeMirrorSpellChecker.dic_loading) {
			CodeMirrorSpellChecker.dic_loading = true;
			var xhr_dic = new XMLHttpRequest();
			xhr_dic.open("GET", options.urlDic, true);
			xhr_dic.onload = function() {
				if(xhr_dic.readyState === 4 && xhr_dic.status === 200) {
					CodeMirrorSpellChecker.dic_data = xhr_dic.responseText;
					CodeMirrorSpellChecker.num_loaded++;

					if(CodeMirrorSpellChecker.num_loaded == 2) {
						CodeMirrorSpellChecker.typo = new Typo(options.language, CodeMirrorSpellChecker.aff_data, CodeMirrorSpellChecker.dic_data, {
							platform: "any"
						});
					}
				}
			};
			xhr_dic.send(null);
		}


		// Define what separates a word
		var rx_word = "!\"#$%&()*+,-./:;<=>?@[\\]^_`{|}~ \t\r\n";


		// Create the overlay and such
		var overlay = {
			token: function(stream) {
				var ch = stream.peek();
				var word = "";

				if(rx_word.includes(ch)) {
					stream.next();
					return null;
				}

				while((ch = stream.peek()) != null && !rx_word.includes(ch)) {
					word += ch;
					stream.next();
				}

				if(CodeMirrorSpellChecker.typo && !CodeMirrorSpellChecker.typo.check(word))
					return "spell-error"; // CSS class: cm-spell-error

				return null;
			}
		};

		var mode = options.codeMirrorInstance.getMode(
			config, config.backdrop || "text/plain"
		);

		return options.codeMirrorInstance.overlayMode(mode, overlay, true);
	});
}


// Initialize data globally to reduce memory consumption
CodeMirrorSpellChecker.num_loaded = 0;
CodeMirrorSpellChecker.aff_loading = false;
CodeMirrorSpellChecker.dic_loading = false;
CodeMirrorSpellChecker.aff_data = "";
CodeMirrorSpellChecker.dic_data = "";
CodeMirrorSpellChecker.typo;


// Export
module.exports = CodeMirrorSpellChecker;
},{"typo-js":2}]},{},[3])(3)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL3R5cG8tanMvdHlwby5qcyIsInNyYy9qcy9zcGVsbC1jaGVja2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbDBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiIiwiLyogZ2xvYmFscyBjaHJvbWU6IGZhbHNlICovXG4vKiBnbG9iYWxzIF9fZGlybmFtZTogZmFsc2UgKi9cbi8qIGdsb2JhbHMgcmVxdWlyZTogZmFsc2UgKi9cbi8qIGdsb2JhbHMgQnVmZmVyOiBmYWxzZSAqL1xuLyogZ2xvYmFscyBtb2R1bGU6IGZhbHNlICovXG4vKipcbiAqIFR5cG8gaXMgYSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIGEgc3BlbGxjaGVja2VyIHVzaW5nIGh1bnNwZWxsLXN0eWxlXG4gKiBkaWN0aW9uYXJpZXMuXG4gKi9cbnZhciBUeXBvO1xuKGZ1bmN0aW9uICgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAvKipcbiAgICAgKiBUeXBvIGNvbnN0cnVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtkaWN0aW9uYXJ5XSBUaGUgbG9jYWxlIGNvZGUgb2YgdGhlIGRpY3Rpb25hcnkgYmVpbmcgdXNlZC4gZS5nLixcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZW5fVVNcIi4gVGhpcyBpcyBvbmx5IHVzZWQgdG8gYXV0by1sb2FkIGRpY3Rpb25hcmllcy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2FmZkRhdGFdICAgIFRoZSBkYXRhIGZyb20gdGhlIGRpY3Rpb25hcnkncyAuYWZmIGZpbGUuIElmIG9taXR0ZWRcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuZCBUeXBvLmpzIGlzIGJlaW5nIHVzZWQgaW4gYSBDaHJvbWUgZXh0ZW5zaW9uLCB0aGUgLmFmZlxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZSB3aWxsIGJlIGxvYWRlZCBhdXRvbWF0aWNhbGx5IGZyb21cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpYi90eXBvL2RpY3Rpb25hcmllcy9bZGljdGlvbmFyeV0vW2RpY3Rpb25hcnldLmFmZlxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSW4gb3RoZXIgZW52aXJvbm1lbnRzLCBpdCB3aWxsIGJlIGxvYWRlZCBmcm9tXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbc2V0dGluZ3MuZGljdGlvbmFyeVBhdGhdL2RpY3Rpb25hcmllcy9bZGljdGlvbmFyeV0vW2RpY3Rpb25hcnldLmFmZlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbd29yZHNEYXRhXSAgVGhlIGRhdGEgZnJvbSB0aGUgZGljdGlvbmFyeSdzIC5kaWMgZmlsZS4gSWYgb21pdHRlZFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5kIFR5cG8uanMgaXMgYmVpbmcgdXNlZCBpbiBhIENocm9tZSBleHRlbnNpb24sIHRoZSAuZGljXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlIHdpbGwgYmUgbG9hZGVkIGF1dG9tYXRpY2FsbHkgZnJvbVxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGliL3R5cG8vZGljdGlvbmFyaWVzL1tkaWN0aW9uYXJ5XS9bZGljdGlvbmFyeV0uZGljXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJbiBvdGhlciBlbnZpcm9ubWVudHMsIGl0IHdpbGwgYmUgbG9hZGVkIGZyb21cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtzZXR0aW5ncy5kaWN0aW9uYXJ5UGF0aF0vZGljdGlvbmFyaWVzL1tkaWN0aW9uYXJ5XS9bZGljdGlvbmFyeV0uZGljXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtzZXR0aW5nc10gICBDb25zdHJ1Y3RvciBzZXR0aW5ncy4gQXZhaWxhYmxlIHByb3BlcnRpZXMgYXJlOlxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3N0cmluZ30gW2RpY3Rpb25hcnlQYXRoXTogcGF0aCB0byBsb2FkIGRpY3Rpb25hcnkgZnJvbSBpbiBub24tY2hyb21lXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnZpcm9ubWVudC5cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtPYmplY3R9IFtmbGFnc106IGZsYWcgaW5mb3JtYXRpb24uXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Ym9vbGVhbn0gW2FzeW5jTG9hZF06IElmIHRydWUsIGFmZkRhdGEgYW5kIHdvcmRzRGF0YSB3aWxsIGJlIGxvYWRlZFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN5bmNocm9ub3VzbHkuXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7RnVuY3Rpb259IFtsb2FkZWRDYWxsYmFja106IENhbGxlZCB3aGVuIGJvdGggYWZmRGF0YSBhbmQgd29yZHNEYXRhXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXZlIGJlZW4gbG9hZGVkLiBPbmx5IHVzZWQgaWYgYXN5bmNMb2FkIGlzIHNldCB0byB0cnVlLiBUaGUgcGFyYW1ldGVyXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpcyB0aGUgaW5zdGFudGlhdGVkIFR5cG8gb2JqZWN0LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1R5cG99IEEgVHlwbyBvYmplY3QuXG4gICAgICovXG4gICAgVHlwbyA9IGZ1bmN0aW9uIChkaWN0aW9uYXJ5LCBhZmZEYXRhLCB3b3Jkc0RhdGEsIHNldHRpbmdzKSB7XG4gICAgICAgIHNldHRpbmdzID0gc2V0dGluZ3MgfHwge307XG4gICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IG51bGw7XG4gICAgICAgIHRoaXMucnVsZXMgPSB7fTtcbiAgICAgICAgdGhpcy5kaWN0aW9uYXJ5VGFibGUgPSB7fTtcbiAgICAgICAgdGhpcy5jb21wb3VuZFJ1bGVzID0gW107XG4gICAgICAgIHRoaXMuY29tcG91bmRSdWxlQ29kZXMgPSB7fTtcbiAgICAgICAgdGhpcy5yZXBsYWNlbWVudFRhYmxlID0gW107XG4gICAgICAgIHRoaXMuZmxhZ3MgPSBzZXR0aW5ncy5mbGFncyB8fCB7fTtcbiAgICAgICAgdGhpcy5tZW1vaXplZCA9IHt9O1xuICAgICAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBwYXRoO1xuICAgICAgICAvLyBMb29wLWNvbnRyb2wgdmFyaWFibGVzLlxuICAgICAgICB2YXIgaSwgaiwgX2xlbiwgX2psZW47XG4gICAgICAgIGlmIChkaWN0aW9uYXJ5KSB7XG4gICAgICAgICAgICBzZWxmLmRpY3Rpb25hcnkgPSBkaWN0aW9uYXJ5O1xuICAgICAgICAgICAgLy8gSWYgdGhlIGRhdGEgaXMgcHJlbG9hZGVkLCBqdXN0IHNldHVwIHRoZSBUeXBvIG9iamVjdC5cbiAgICAgICAgICAgIGlmIChhZmZEYXRhICYmIHdvcmRzRGF0YSkge1xuICAgICAgICAgICAgICAgIHNldHVwKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBMb2FkaW5nIGRhdGEgZm9yIENocm9tZSBleHRlbnRpb25zLlxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdy5jaHJvbWUgfHwgd2luZG93LmJyb3dzZXIpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJ1bnRpbWUgPSB3aW5kb3cuY2hyb21lICYmIHdpbmRvdy5jaHJvbWUucnVudGltZSA/IHdpbmRvdy5jaHJvbWUucnVudGltZSA6IGJyb3dzZXIucnVudGltZTtcbiAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuZGljdGlvbmFyeVBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0aCA9IHNldHRpbmdzLmRpY3Rpb25hcnlQYXRoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0aCA9IFwidHlwby9kaWN0aW9uYXJpZXNcIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFhZmZEYXRhKVxuICAgICAgICAgICAgICAgICAgICByZWFkRGF0YUZpbGUocnVudGltZS5nZXRVUkwocGF0aCArIFwiL1wiICsgZGljdGlvbmFyeSArIFwiL1wiICsgZGljdGlvbmFyeSArIFwiLmFmZlwiKSwgc2V0QWZmRGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKCF3b3Jkc0RhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJlYWREYXRhRmlsZShydW50aW1lLmdldFVSTChwYXRoICsgXCIvXCIgKyBkaWN0aW9uYXJ5ICsgXCIvXCIgKyBkaWN0aW9uYXJ5ICsgXCIuZGljXCIpLCBzZXRXb3Jkc0RhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gTG9hZGluZyBkYXRhIGZvciBOb2RlLmpzIG9yIG90aGVyIGVudmlyb25tZW50cy5cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzZXR0aW5ncy5kaWN0aW9uYXJ5UGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBwYXRoID0gc2V0dGluZ3MuZGljdGlvbmFyeVBhdGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiBfX2Rpcm5hbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhdGggPSBfX2Rpcm5hbWUgKyAnL2RpY3Rpb25hcmllcyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXRoID0gJy4vZGljdGlvbmFyaWVzJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFhZmZEYXRhKVxuICAgICAgICAgICAgICAgICAgICByZWFkRGF0YUZpbGUocGF0aCArIFwiL1wiICsgZGljdGlvbmFyeSArIFwiL1wiICsgZGljdGlvbmFyeSArIFwiLmFmZlwiLCBzZXRBZmZEYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoIXdvcmRzRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmVhZERhdGFGaWxlKHBhdGggKyBcIi9cIiArIGRpY3Rpb25hcnkgKyBcIi9cIiArIGRpY3Rpb25hcnkgKyBcIi5kaWNcIiwgc2V0V29yZHNEYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiByZWFkRGF0YUZpbGUodXJsLCBzZXRGdW5jKSB7XG4gICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSBzZWxmLl9yZWFkRmlsZSh1cmwsIG51bGwsIHNldHRpbmdzID09PSBudWxsIHx8IHNldHRpbmdzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBzZXR0aW5ncy5hc3luY0xvYWQpO1xuICAgICAgICAgICAgaWYgKHNldHRpbmdzID09PSBudWxsIHx8IHNldHRpbmdzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBzZXR0aW5ncy5hc3luY0xvYWQpIHtcbiAgICAgICAgICAgICAgICByZXNwb25zZS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldEZ1bmMoZGF0YSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRGdW5jKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBzZXRBZmZEYXRhKGRhdGEpIHtcbiAgICAgICAgICAgIGFmZkRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgaWYgKHdvcmRzRGF0YSkge1xuICAgICAgICAgICAgICAgIHNldHVwKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gc2V0V29yZHNEYXRhKGRhdGEpIHtcbiAgICAgICAgICAgIHdvcmRzRGF0YSA9IGRhdGE7XG4gICAgICAgICAgICBpZiAoYWZmRGF0YSkge1xuICAgICAgICAgICAgICAgIHNldHVwKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gc2V0dXAoKSB7XG4gICAgICAgICAgICBzZWxmLnJ1bGVzID0gc2VsZi5fcGFyc2VBRkYoYWZmRGF0YSk7XG4gICAgICAgICAgICAvLyBTYXZlIHRoZSBydWxlIGNvZGVzIHRoYXQgYXJlIHVzZWQgaW4gY29tcG91bmQgcnVsZXMuXG4gICAgICAgICAgICBzZWxmLmNvbXBvdW5kUnVsZUNvZGVzID0ge307XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBfbGVuID0gc2VsZi5jb21wb3VuZFJ1bGVzLmxlbmd0aDsgaSA8IF9sZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBydWxlID0gc2VsZi5jb21wb3VuZFJ1bGVzW2ldO1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDAsIF9qbGVuID0gcnVsZS5sZW5ndGg7IGogPCBfamxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuY29tcG91bmRSdWxlQ29kZXNbcnVsZVtqXV0gPSBbXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBJZiB3ZSBhZGQgdGhpcyBPTkxZSU5DT01QT1VORCBmbGFnIHRvIHNlbGYuY29tcG91bmRSdWxlQ29kZXMsIHRoZW4gX3BhcnNlRElDXG4gICAgICAgICAgICAvLyB3aWxsIGRvIHRoZSB3b3JrIG9mIHNhdmluZyB0aGUgbGlzdCBvZiB3b3JkcyB0aGF0IGFyZSBjb21wb3VuZC1vbmx5LlxuICAgICAgICAgICAgaWYgKFwiT05MWUlOQ09NUE9VTkRcIiBpbiBzZWxmLmZsYWdzKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5jb21wb3VuZFJ1bGVDb2Rlc1tzZWxmLmZsYWdzLk9OTFlJTkNPTVBPVU5EXSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi5kaWN0aW9uYXJ5VGFibGUgPSBzZWxmLl9wYXJzZURJQyh3b3Jkc0RhdGEpO1xuICAgICAgICAgICAgLy8gR2V0IHJpZCBvZiBhbnkgY29kZXMgZnJvbSB0aGUgY29tcG91bmQgcnVsZSBjb2RlcyB0aGF0IGFyZSBuZXZlciB1c2VkXG4gICAgICAgICAgICAvLyAob3IgdGhhdCB3ZXJlIHNwZWNpYWwgcmVnZXggY2hhcmFjdGVycykuICBOb3QgZXNwZWNpYWxseSBuZWNlc3NhcnkuLi5cbiAgICAgICAgICAgIGZvciAoaSBpbiBzZWxmLmNvbXBvdW5kUnVsZUNvZGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYuY29tcG91bmRSdWxlQ29kZXNbaV0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzZWxmLmNvbXBvdW5kUnVsZUNvZGVzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEJ1aWxkIHRoZSBmdWxsIHJlZ3VsYXIgZXhwcmVzc2lvbnMgZm9yIGVhY2ggY29tcG91bmQgcnVsZS5cbiAgICAgICAgICAgIC8vIEkgaGF2ZSBhIGZlZWxpbmcgKGJ1dCBubyBjb25maXJtYXRpb24geWV0KSB0aGF0IHRoaXMgbWV0aG9kIG9mXG4gICAgICAgICAgICAvLyB0ZXN0aW5nIGZvciBjb21wb3VuZCB3b3JkcyBpcyBwcm9iYWJseSBzbG93LlxuICAgICAgICAgICAgZm9yIChpID0gMCwgX2xlbiA9IHNlbGYuY29tcG91bmRSdWxlcy5sZW5ndGg7IGkgPCBfbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcnVsZVRleHQgPSBzZWxmLmNvbXBvdW5kUnVsZXNbaV07XG4gICAgICAgICAgICAgICAgdmFyIGV4cHJlc3Npb25UZXh0ID0gXCJcIjtcbiAgICAgICAgICAgICAgICBmb3IgKGogPSAwLCBfamxlbiA9IHJ1bGVUZXh0Lmxlbmd0aDsgaiA8IF9qbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoYXJhY3RlciA9IHJ1bGVUZXh0W2pdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2hhcmFjdGVyIGluIHNlbGYuY29tcG91bmRSdWxlQ29kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb25UZXh0ICs9IFwiKFwiICsgc2VsZi5jb21wb3VuZFJ1bGVDb2Rlc1tjaGFyYWN0ZXJdLmpvaW4oXCJ8XCIpICsgXCIpXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHByZXNzaW9uVGV4dCArPSBjaGFyYWN0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2VsZi5jb21wb3VuZFJ1bGVzW2ldID0gbmV3IFJlZ0V4cCgnXicgKyBleHByZXNzaW9uVGV4dCArICckJywgXCJpXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi5sb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKChzZXR0aW5ncyA9PT0gbnVsbCB8fCBzZXR0aW5ncyA9PT0gdm9pZCAwID8gdm9pZCAwIDogc2V0dGluZ3MuYXN5bmNMb2FkKSAmJiAoc2V0dGluZ3MgPT09IG51bGwgfHwgc2V0dGluZ3MgPT09IHZvaWQgMCA/IHZvaWQgMCA6IHNldHRpbmdzLmxvYWRlZENhbGxiYWNrKSkge1xuICAgICAgICAgICAgICAgIHNldHRpbmdzLmxvYWRlZENhbGxiYWNrKHNlbGYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgVHlwby5wcm90b3R5cGUgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMb2FkcyBhIFR5cG8gaW5zdGFuY2UgZnJvbSBhIGhhc2ggb2YgYWxsIG9mIHRoZSBUeXBvIHByb3BlcnRpZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvYmogQSBoYXNoIG9mIFR5cG8gcHJvcGVydGllcywgcHJvYmFibHkgZ290dGVuIGZyb20gYSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHR5cG9faW5zdGFuY2UpKS5cbiAgICAgICAgICovXG4gICAgICAgIGxvYWQ6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gb2JqKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW2ldID0gb2JqW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmVhZCB0aGUgY29udGVudHMgb2YgYSBmaWxlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aCBUaGUgcGF0aCAocmVsYXRpdmUpIHRvIHRoZSBmaWxlLlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2NoYXJzZXQ9XCJJU084ODU5LTFcIl0gVGhlIGV4cGVjdGVkIGNoYXJzZXQgb2YgdGhlIGZpbGVcbiAgICAgICAgICogQHBhcmFtIHtib29sZWFufSBhc3luYyBJZiB0cnVlLCB0aGUgZmlsZSB3aWxsIGJlIHJlYWQgYXN5bmNocm9ub3VzbHkuIEZvciBub2RlLmpzIHRoaXMgZG9lcyBub3RoaW5nLCBhbGxcbiAgICAgICAgICogICAgICAgIGZpbGVzIGFyZSByZWFkIHN5bmNocm9ub3VzbHkuXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBmaWxlIGRhdGEgaWYgYXN5bmMgaXMgZmFsc2UsIG90aGVyd2lzZSBhIHByb21pc2Ugb2JqZWN0LiBJZiBydW5uaW5nIG5vZGUuanMsIHRoZSBkYXRhIGlzXG4gICAgICAgICAqICAgICAgICAgIGFsd2F5cyByZXR1cm5lZC5cbiAgICAgICAgICovXG4gICAgICAgIF9yZWFkRmlsZTogZnVuY3Rpb24gKHBhdGgsIGNoYXJzZXQsIGFzeW5jKSB7XG4gICAgICAgICAgICB2YXIgX2E7XG4gICAgICAgICAgICBjaGFyc2V0ID0gY2hhcnNldCB8fCBcInV0ZjhcIjtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlcV8xID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgcmVxXzEub3BlbihcIkdFVFwiLCBwYXRoLCAhIWFzeW5jKTtcbiAgICAgICAgICAgICAgICAoX2EgPSByZXFfMS5vdmVycmlkZU1pbWVUeXBlKSA9PT0gbnVsbCB8fCBfYSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2EuY2FsbChyZXFfMSwgXCJ0ZXh0L3BsYWluOyBjaGFyc2V0PVwiICsgY2hhcnNldCk7XG4gICAgICAgICAgICAgICAgaWYgKCEhYXN5bmMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXFfMS5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcV8xLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVxXzEucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChyZXFfMS5zdGF0dXNUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVxXzEub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QocmVxXzEuc3RhdHVzVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmVxXzEuc2VuZChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXFfMS5zZW5kKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVxXzEucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIC8vIE5vZGUuanNcbiAgICAgICAgICAgICAgICB2YXIgZnMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmcy5yZWFkRmlsZVN5bmMocGF0aCwgY2hhcnNldCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlBhdGggXCIgKyBwYXRoICsgXCIgZG9lcyBub3QgZXhpc3QuXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQYXJzZSB0aGUgcnVsZXMgb3V0IGZyb20gYSAuYWZmIGZpbGUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBkYXRhIFRoZSBjb250ZW50cyBvZiB0aGUgYWZmaXggZmlsZS5cbiAgICAgICAgICogQHJldHVybnMgb2JqZWN0IFRoZSBydWxlcyBmcm9tIHRoZSBmaWxlLlxuICAgICAgICAgKi9cbiAgICAgICAgX3BhcnNlQUZGOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgdmFyIHJ1bGVzID0ge307XG4gICAgICAgICAgICB2YXIgbGluZSwgc3VibGluZSwgbnVtRW50cmllcywgbGluZVBhcnRzO1xuICAgICAgICAgICAgdmFyIGksIGosIF9sZW4sIF9qbGVuO1xuICAgICAgICAgICAgdmFyIGxpbmVzID0gZGF0YS5zcGxpdCgvXFxyP1xcbi8pO1xuICAgICAgICAgICAgZm9yIChpID0gMCwgX2xlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IF9sZW47IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBjb21tZW50IGxpbmVzXG4gICAgICAgICAgICAgICAgbGluZSA9IHRoaXMuX3JlbW92ZUFmZml4Q29tbWVudHMobGluZXNbaV0pO1xuICAgICAgICAgICAgICAgIGxpbmUgPSBsaW5lLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxpbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBkZWZpbml0aW9uUGFydHMgPSBsaW5lLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgICAgdmFyIHJ1bGVUeXBlID0gZGVmaW5pdGlvblBhcnRzWzBdO1xuICAgICAgICAgICAgICAgIGlmIChydWxlVHlwZSA9PT0gXCJQRlhcIiB8fCBydWxlVHlwZSA9PT0gXCJTRlhcIikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcnVsZUNvZGUgPSBkZWZpbml0aW9uUGFydHNbMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBjb21iaW5lYWJsZSA9IGRlZmluaXRpb25QYXJ0c1syXTtcbiAgICAgICAgICAgICAgICAgICAgbnVtRW50cmllcyA9IHBhcnNlSW50KGRlZmluaXRpb25QYXJ0c1szXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZW50cmllcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGogPSBpICsgMSwgX2psZW4gPSBpICsgMSArIG51bUVudHJpZXM7IGogPCBfamxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJsaW5lID0gbGluZXNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lUGFydHMgPSBzdWJsaW5lLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hhcmFjdGVyc1RvUmVtb3ZlID0gbGluZVBhcnRzWzJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGl0aW9uUGFydHMgPSBsaW5lUGFydHNbM10uc3BsaXQoXCIvXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoYXJhY3RlcnNUb0FkZCA9IGFkZGl0aW9uUGFydHNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hhcmFjdGVyc1RvQWRkID09PSBcIjBcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyYWN0ZXJzVG9BZGQgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbnRpbnVhdGlvbkNsYXNzZXMgPSB0aGlzLnBhcnNlUnVsZUNvZGVzKGFkZGl0aW9uUGFydHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlZ2V4VG9NYXRjaCA9IGxpbmVQYXJ0c1s0XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlbnRyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGQ6IGNoYXJhY3RlcnNUb0FkZFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb250aW51YXRpb25DbGFzc2VzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cnkuY29udGludWF0aW9uQ2xhc3NlcyA9IGNvbnRpbnVhdGlvbkNsYXNzZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVnZXhUb01hdGNoICE9PSBcIi5cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChydWxlVHlwZSA9PT0gXCJTRlhcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyeS5tYXRjaCA9IG5ldyBSZWdFeHAocmVnZXhUb01hdGNoICsgXCIkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cnkubWF0Y2ggPSBuZXcgUmVnRXhwKFwiXlwiICsgcmVnZXhUb01hdGNoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hhcmFjdGVyc1RvUmVtb3ZlICE9IFwiMFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJ1bGVUeXBlID09PSBcIlNGWFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJ5LnJlbW92ZSA9IG5ldyBSZWdFeHAoY2hhcmFjdGVyc1RvUmVtb3ZlICsgXCIkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cnkucmVtb3ZlID0gY2hhcmFjdGVyc1RvUmVtb3ZlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVudHJpZXMucHVzaChlbnRyeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcnVsZXNbcnVsZUNvZGVdID0geyBcInR5cGVcIjogcnVsZVR5cGUsIFwiY29tYmluZWFibGVcIjogKGNvbWJpbmVhYmxlID09PSBcIllcIiksIFwiZW50cmllc1wiOiBlbnRyaWVzIH07XG4gICAgICAgICAgICAgICAgICAgIGkgKz0gbnVtRW50cmllcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocnVsZVR5cGUgPT09IFwiQ09NUE9VTkRSVUxFXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtRW50cmllcyA9IHBhcnNlSW50KGRlZmluaXRpb25QYXJ0c1sxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGogPSBpICsgMSwgX2psZW4gPSBpICsgMSArIG51bUVudHJpZXM7IGogPCBfamxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lID0gbGluZXNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lUGFydHMgPSBsaW5lLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbXBvdW5kUnVsZXMucHVzaChsaW5lUGFydHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGkgKz0gbnVtRW50cmllcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocnVsZVR5cGUgPT09IFwiUkVQXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZVBhcnRzID0gbGluZS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGluZVBhcnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXBsYWNlbWVudFRhYmxlLnB1c2goW2xpbmVQYXJ0c1sxXSwgbGluZVBhcnRzWzJdXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9OTFlJTkNPTVBPVU5EXG4gICAgICAgICAgICAgICAgICAgIC8vIENPTVBPVU5ETUlOXG4gICAgICAgICAgICAgICAgICAgIC8vIEZMQUdcbiAgICAgICAgICAgICAgICAgICAgLy8gS0VFUENBU0VcbiAgICAgICAgICAgICAgICAgICAgLy8gTkVFREFGRklYXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmxhZ3NbcnVsZVR5cGVdID0gZGVmaW5pdGlvblBhcnRzWzFdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBydWxlcztcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZXMgY29tbWVudHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBkYXRhIEEgbGluZSBmcm9tIGFuIGFmZml4IGZpbGUuXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gVGhlIGNsZWFuZWQtdXAgbGluZS5cbiAgICAgICAgICovXG4gICAgICAgIF9yZW1vdmVBZmZpeENvbW1lbnRzOiBmdW5jdGlvbiAobGluZSkge1xuICAgICAgICAgICAgLy8gVGhpcyB1c2VkIHRvIHJlbW92ZSBhbnkgc3RyaW5nIHN0YXJ0aW5nIHdpdGggJyMnIHVwIHRvIHRoZSBlbmQgb2YgdGhlIGxpbmUsXG4gICAgICAgICAgICAvLyBidXQgc29tZSBDT01QT1VORFJVTEUgZGVmaW5pdGlvbnMgaW5jbHVkZSAnIycgYXMgcGFydCBvZiB0aGUgcnVsZS5cbiAgICAgICAgICAgIC8vIFNvLCBvbmx5IHJlbW92ZSBsaW5lcyB0aGF0IGJlZ2luIHdpdGggYSBjb21tZW50LCBvcHRpb25hbGx5IHByZWNlZGVkIGJ5IHdoaXRlc3BhY2UuXG4gICAgICAgICAgICBpZiAobGluZS5tYXRjaCgvXlxccyojLykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbGluZTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFBhcnNlcyB0aGUgd29yZHMgb3V0IGZyb20gdGhlIC5kaWMgZmlsZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGRhdGEgVGhlIGRhdGEgZnJvbSB0aGUgZGljdGlvbmFyeSBmaWxlLlxuICAgICAgICAgKiBAcmV0dXJucyBIYXNoTWFwIFRoZSBsb29rdXAgdGFibGUgY29udGFpbmluZyBhbGwgb2YgdGhlIHdvcmRzIGFuZFxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgd29yZCBmb3JtcyBmcm9tIHRoZSBkaWN0aW9uYXJ5LlxuICAgICAgICAgKi9cbiAgICAgICAgX3BhcnNlRElDOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgZGF0YSA9IHRoaXMuX3JlbW92ZURpY0NvbW1lbnRzKGRhdGEpO1xuICAgICAgICAgICAgdmFyIGxpbmVzID0gZGF0YS5zcGxpdCgvXFxyP1xcbi8pO1xuICAgICAgICAgICAgdmFyIGRpY3Rpb25hcnlUYWJsZSA9IHt9O1xuICAgICAgICAgICAgZnVuY3Rpb24gYWRkV29yZCh3b3JkLCBydWxlcykge1xuICAgICAgICAgICAgICAgIC8vIFNvbWUgZGljdGlvbmFyaWVzIHdpbGwgbGlzdCB0aGUgc2FtZSB3b3JkIG11bHRpcGxlIHRpbWVzIHdpdGggZGlmZmVyZW50IHJ1bGUgc2V0cy5cbiAgICAgICAgICAgICAgICBpZiAoIWRpY3Rpb25hcnlUYWJsZS5oYXNPd25Qcm9wZXJ0eSh3b3JkKSkge1xuICAgICAgICAgICAgICAgICAgICBkaWN0aW9uYXJ5VGFibGVbd29yZF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocnVsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGljdGlvbmFyeVRhYmxlW3dvcmRdID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWN0aW9uYXJ5VGFibGVbd29yZF0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkaWN0aW9uYXJ5VGFibGVbd29yZF0ucHVzaChydWxlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVGhlIGZpcnN0IGxpbmUgaXMgdGhlIG51bWJlciBvZiB3b3JkcyBpbiB0aGUgZGljdGlvbmFyeS5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxLCBfbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgX2xlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxpbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSWdub3JlIGVtcHR5IGxpbmVzLlxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHBhcnRzID0gbGluZS5zcGxpdChcIi9cIiwgMik7XG4gICAgICAgICAgICAgICAgdmFyIHdvcmQgPSBwYXJ0c1swXTtcbiAgICAgICAgICAgICAgICAvLyBOb3cgZm9yIGVhY2ggYWZmaXggcnVsZSwgZ2VuZXJhdGUgdGhhdCBmb3JtIG9mIHRoZSB3b3JkLlxuICAgICAgICAgICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBydWxlQ29kZXNBcnJheSA9IHRoaXMucGFyc2VSdWxlQ29kZXMocGFydHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICAvLyBTYXZlIHRoZSBydWxlQ29kZXMgZm9yIGNvbXBvdW5kIHdvcmQgc2l0dWF0aW9ucy5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoXCJORUVEQUZGSVhcIiBpbiB0aGlzLmZsYWdzKSB8fCBydWxlQ29kZXNBcnJheS5pbmRleE9mKHRoaXMuZmxhZ3MuTkVFREFGRklYKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZFdvcmQod29yZCwgcnVsZUNvZGVzQXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwLCBfamxlbiA9IHJ1bGVDb2Rlc0FycmF5Lmxlbmd0aDsgaiA8IF9qbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2RlID0gcnVsZUNvZGVzQXJyYXlbal07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcnVsZSA9IHRoaXMucnVsZXNbY29kZV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocnVsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdXb3JkcyA9IHRoaXMuX2FwcGx5UnVsZSh3b3JkLCBydWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpaSA9IDAsIF9paWxlbiA9IG5ld1dvcmRzLmxlbmd0aDsgaWkgPCBfaWlsZW47IGlpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1dvcmQgPSBuZXdXb3Jkc1tpaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFdvcmQobmV3V29yZCwgW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocnVsZS5jb21iaW5lYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgayA9IGogKyAxOyBrIDwgX2psZW47IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb21iaW5lQ29kZSA9IHJ1bGVDb2Rlc0FycmF5W2tdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb21iaW5lUnVsZSA9IHRoaXMucnVsZXNbY29tYmluZUNvZGVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21iaW5lUnVsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tYmluZVJ1bGUuY29tYmluZWFibGUgJiYgKHJ1bGUudHlwZSAhPSBjb21iaW5lUnVsZS50eXBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG90aGVyTmV3V29yZHMgPSB0aGlzLl9hcHBseVJ1bGUobmV3V29yZCwgY29tYmluZVJ1bGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaWlpID0gMCwgX2lpaWxlbiA9IG90aGVyTmV3V29yZHMubGVuZ3RoOyBpaWkgPCBfaWlpbGVuOyBpaWkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvdGhlck5ld1dvcmQgPSBvdGhlck5ld1dvcmRzW2lpaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkV29yZChvdGhlck5ld1dvcmQsIFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2RlIGluIHRoaXMuY29tcG91bmRSdWxlQ29kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbXBvdW5kUnVsZUNvZGVzW2NvZGVdLnB1c2god29yZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGFkZFdvcmQod29yZC50cmltKCksIFtdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGljdGlvbmFyeVRhYmxlO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlcyBjb21tZW50IGxpbmVzIGFuZCB0aGVuIGNsZWFucyB1cCBibGFuayBsaW5lcyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGRhdGEgVGhlIGRhdGEgZnJvbSBhIC5kaWMgZmlsZS5cbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBUaGUgY2xlYW5lZC11cCBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgX3JlbW92ZURpY0NvbW1lbnRzOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgLy8gSSBjYW4ndCBmaW5kIGFueSBvZmZpY2lhbCBkb2N1bWVudGF0aW9uIG9uIGl0LCBidXQgYXQgbGVhc3QgdGhlIGRlX0RFXG4gICAgICAgICAgICAvLyBkaWN0aW9uYXJ5IHVzZXMgdGFiLWluZGVudGVkIGxpbmVzIGFzIGNvbW1lbnRzLlxuICAgICAgICAgICAgLy8gUmVtb3ZlIGNvbW1lbnRzXG4gICAgICAgICAgICBkYXRhID0gZGF0YS5yZXBsYWNlKC9eXFx0LiokL21nLCBcIlwiKTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9LFxuICAgICAgICBwYXJzZVJ1bGVDb2RlczogZnVuY3Rpb24gKHRleHRDb2Rlcykge1xuICAgICAgICAgICAgaWYgKCF0ZXh0Q29kZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICghKFwiRkxBR1wiIGluIHRoaXMuZmxhZ3MpKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIGZsYWcgc3ltYm9scyBhcmUgc2luZ2xlIGNoYXJhY3RlcnNcbiAgICAgICAgICAgICAgICByZXR1cm4gdGV4dENvZGVzLnNwbGl0KFwiXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5mbGFncy5GTEFHID09PSBcImxvbmdcIikge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBmbGFnIHN5bWJvbHMgYXJlIHR3byBjaGFyYWN0ZXJzIGxvbmcuXG4gICAgICAgICAgICAgICAgdmFyIGZsYWdzID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIF9sZW4gPSB0ZXh0Q29kZXMubGVuZ3RoOyBpIDwgX2xlbjsgaSArPSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsYWdzLnB1c2godGV4dENvZGVzLnN1YnN0cihpLCAyKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmbGFncztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZmxhZ3MuRkxBRyA9PT0gXCJudW1cIikge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBmbGFnIHN5bWJvbHMgYXJlIGEgQ1NWIGxpc3Qgb2YgbnVtYmVycy5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGV4dENvZGVzLnNwbGl0KFwiLFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZmxhZ3MuRkxBRyA9PT0gXCJVVEYtOFwiKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIGZsYWdzIGFyZSBzaW5nbGUgVVRGLTggY2hhcmFjdGVycy5cbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jZmlua2UvVHlwby5qcy9pc3N1ZXMvNTdcbiAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkuZnJvbSh0ZXh0Q29kZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBwb3NzaWJsZSB0aGF0IHRoaXMgZmFsbGJhY2sgY2FzZSB3aWxsIG5vdCB3b3JrIGZvciBhbGwgRkxBRyB2YWx1ZXMsXG4gICAgICAgICAgICAgICAgLy8gYnV0IEkgdGhpbmsgaXQncyBtb3JlIGxpa2VseSB0byB3b3JrIHRoYW4gbm90IHJldHVybmluZyBhbnl0aGluZyBhdCBhbGwuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHRDb2Rlcy5zcGxpdChcIlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFwcGxpZXMgYW4gYWZmaXggcnVsZSB0byBhIHdvcmQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSB3b3JkIFRoZSBiYXNlIHdvcmQuXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBydWxlIFRoZSBhZmZpeCBydWxlLlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119IFRoZSBuZXcgd29yZHMgZ2VuZXJhdGVkIGJ5IHRoZSBydWxlLlxuICAgICAgICAgKi9cbiAgICAgICAgX2FwcGx5UnVsZTogZnVuY3Rpb24gKHdvcmQsIHJ1bGUpIHtcbiAgICAgICAgICAgIHZhciBlbnRyaWVzID0gcnVsZS5lbnRyaWVzO1xuICAgICAgICAgICAgdmFyIG5ld1dvcmRzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgX2xlbiA9IGVudHJpZXMubGVuZ3RoOyBpIDwgX2xlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVudHJ5ID0gZW50cmllc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWVudHJ5Lm1hdGNoIHx8IHdvcmQubWF0Y2goZW50cnkubWF0Y2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdXb3JkID0gd29yZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5LnJlbW92ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3V29yZCA9IG5ld1dvcmQucmVwbGFjZShlbnRyeS5yZW1vdmUsIFwiXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChydWxlLnR5cGUgPT09IFwiU0ZYXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1dvcmQgPSBuZXdXb3JkICsgZW50cnkuYWRkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3V29yZCA9IGVudHJ5LmFkZCArIG5ld1dvcmQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbmV3V29yZHMucHVzaChuZXdXb3JkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFwiY29udGludWF0aW9uQ2xhc3Nlc1wiIGluIGVudHJ5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMCwgX2psZW4gPSBlbnRyeS5jb250aW51YXRpb25DbGFzc2VzLmxlbmd0aDsgaiA8IF9qbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29udGludWF0aW9uUnVsZSA9IHRoaXMucnVsZXNbZW50cnkuY29udGludWF0aW9uQ2xhc3Nlc1tqXV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRpbnVhdGlvblJ1bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3V29yZHMgPSBuZXdXb3Jkcy5jb25jYXQodGhpcy5fYXBwbHlSdWxlKG5ld1dvcmQsIGNvbnRpbnVhdGlvblJ1bGUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBzaG91bGRuJ3QgaGFwcGVuLCBidXQgaXQgZG9lcywgYXQgbGVhc3QgaW4gdGhlIGRlX0RFIGRpY3Rpb25hcnkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEkgdGhpbmsgdGhlIGF1dGhvciBtaXN0YWtlbmx5IHN1cHBsaWVkIGxvd2VyLWNhc2UgcnVsZSBjb2RlcyBpbnN0ZWFkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9mIHVwcGVyLWNhc2UuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3V29yZHM7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVja3Mgd2hldGhlciBhIHdvcmQgb3IgYSBjYXBpdGFsaXphdGlvbiB2YXJpYW50IGV4aXN0cyBpbiB0aGUgY3VycmVudCBkaWN0aW9uYXJ5LlxuICAgICAgICAgKiBUaGUgd29yZCBpcyB0cmltbWVkIGFuZCBzZXZlcmFsIHZhcmlhdGlvbnMgb2YgY2FwaXRhbGl6YXRpb25zIGFyZSBjaGVja2VkLlxuICAgICAgICAgKiBJZiB5b3Ugd2FudCB0byBjaGVjayBhIHdvcmQgd2l0aG91dCBhbnkgY2hhbmdlcyBtYWRlIHRvIGl0LCBjYWxsIGNoZWNrRXhhY3QoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAc2VlIGh0dHA6Ly9ibG9nLnN0ZXZlbmxldml0aGFuLmNvbS9hcmNoaXZlcy9mYXN0ZXItdHJpbS1qYXZhc2NyaXB0IHJlOnRyaW1taW5nIGZ1bmN0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBhV29yZCBUaGUgd29yZCB0byBjaGVjay5cbiAgICAgICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBjaGVjazogZnVuY3Rpb24gKGFXb3JkKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMubG9hZGVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJEaWN0aW9uYXJ5IG5vdCBsb2FkZWQuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWFXb3JkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgICAgICAgIHZhciB0cmltbWVkV29yZCA9IGFXb3JkLnJlcGxhY2UoL15cXHNcXHMqLywgJycpLnJlcGxhY2UoL1xcc1xccyokLywgJycpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY2hlY2tFeGFjdCh0cmltbWVkV29yZCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRoZSBleGFjdCB3b3JkIGlzIG5vdCBpbiB0aGUgZGljdGlvbmFyeS5cbiAgICAgICAgICAgIGlmICh0cmltbWVkV29yZC50b1VwcGVyQ2FzZSgpID09PSB0cmltbWVkV29yZCkge1xuICAgICAgICAgICAgICAgIC8vIFRoZSB3b3JkIHdhcyBzdXBwbGllZCBpbiBhbGwgdXBwZXJjYXNlLlxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGZvciBhIGNhcGl0YWxpemVkIGZvcm0gb2YgdGhlIHdvcmQuXG4gICAgICAgICAgICAgICAgdmFyIGNhcGl0YWxpemVkV29yZCA9IHRyaW1tZWRXb3JkWzBdICsgdHJpbW1lZFdvcmQuc3Vic3RyaW5nKDEpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaGFzRmxhZyhjYXBpdGFsaXplZFdvcmQsIFwiS0VFUENBU0VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FwaXRhbGl6YXRpb24gdmFyaWFudHMgYXJlIG5vdCBhbGxvd2VkIGZvciB0aGlzIHdvcmQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY2hlY2tFeGFjdChjYXBpdGFsaXplZFdvcmQpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBhbGwtY2FwcyB3b3JkIGlzIGEgY2FwaXRhbGl6ZWQgd29yZCBzcGVsbGVkIGNvcnJlY3RseS5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNoZWNrRXhhY3QodHJpbW1lZFdvcmQudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGFsbC1jYXBzIGlzIGEgbG93ZXJjYXNlIHdvcmQgc3BlbGxlZCBjb3JyZWN0bHkuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1bmNhcGl0YWxpemVkV29yZCA9IHRyaW1tZWRXb3JkWzBdLnRvTG93ZXJDYXNlKCkgKyB0cmltbWVkV29yZC5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICBpZiAodW5jYXBpdGFsaXplZFdvcmQgIT09IHRyaW1tZWRXb3JkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaGFzRmxhZyh1bmNhcGl0YWxpemVkV29yZCwgXCJLRUVQQ0FTRVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYXBpdGFsaXphdGlvbiB2YXJpYW50cyBhcmUgbm90IGFsbG93ZWQgZm9yIHRoaXMgd29yZC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgYW4gdW5jYXBpdGFsaXplZCBmb3JtXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY2hlY2tFeGFjdCh1bmNhcGl0YWxpemVkV29yZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIHdvcmQgaXMgc3BlbGxlZCBjb3JyZWN0bHkgYnV0IHdpdGggdGhlIGZpcnN0IGxldHRlciBjYXBpdGFsaXplZC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2tzIHdoZXRoZXIgYSB3b3JkIGV4aXN0cyBpbiB0aGUgY3VycmVudCBkaWN0aW9uYXJ5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gd29yZCBUaGUgd29yZCB0byBjaGVjay5cbiAgICAgICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBjaGVja0V4YWN0OiBmdW5jdGlvbiAod29yZCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgIHRocm93IFwiRGljdGlvbmFyeSBub3QgbG9hZGVkLlwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJ1bGVDb2RlcyA9IHRoaXMuZGljdGlvbmFyeVRhYmxlW3dvcmRdO1xuICAgICAgICAgICAgdmFyIGksIF9sZW47XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJ1bGVDb2RlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiB0aGlzIG1pZ2h0IGJlIGEgY29tcG91bmQgd29yZC5cbiAgICAgICAgICAgICAgICBpZiAoXCJDT01QT1VORE1JTlwiIGluIHRoaXMuZmxhZ3MgJiYgd29yZC5sZW5ndGggPj0gdGhpcy5mbGFncy5DT01QT1VORE1JTikge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBfbGVuID0gdGhpcy5jb21wb3VuZFJ1bGVzLmxlbmd0aDsgaSA8IF9sZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdvcmQubWF0Y2godGhpcy5jb21wb3VuZFJ1bGVzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAocnVsZUNvZGVzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gYSBudWxsIChidXQgbm90IHVuZGVmaW5lZCkgdmFsdWUgZm9yIGFuIGVudHJ5IGluIHRoZSBkaWN0aW9uYXJ5IHRhYmxlXG4gICAgICAgICAgICAgICAgLy8gbWVhbnMgdGhhdCB0aGUgd29yZCBpcyBpbiB0aGUgZGljdGlvbmFyeSBidXQgaGFzIG5vIGZsYWdzLlxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIHJ1bGVDb2RlcyA9PT0gJ29iamVjdCcpIHsgLy8gdGhpcy5kaWN0aW9uYXJ5WydoYXNPd25Qcm9wZXJ0eSddIHdpbGwgYmUgYSBmdW5jdGlvbi5cbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBfbGVuID0gcnVsZUNvZGVzLmxlbmd0aDsgaSA8IF9sZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzRmxhZyh3b3JkLCBcIk9OTFlJTkNPTVBPVU5EXCIsIHJ1bGVDb2Rlc1tpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogTG9va3MgdXAgd2hldGhlciBhIGdpdmVuIHdvcmQgaXMgZmxhZ2dlZCB3aXRoIGEgZ2l2ZW4gZmxhZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHdvcmQgVGhlIHdvcmQgaW4gcXVlc3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmbGFnIFRoZSBmbGFnIGluIHF1ZXN0aW9uLlxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzRmxhZzogZnVuY3Rpb24gKHdvcmQsIGZsYWcsIHdvcmRGbGFncykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgIHRocm93IFwiRGljdGlvbmFyeSBub3QgbG9hZGVkLlwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZsYWcgaW4gdGhpcy5mbGFncykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygd29yZEZsYWdzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICB3b3JkRmxhZ3MgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KFtdLCB0aGlzLmRpY3Rpb25hcnlUYWJsZVt3b3JkXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh3b3JkRmxhZ3MgJiYgd29yZEZsYWdzLmluZGV4T2YodGhpcy5mbGFnc1tmbGFnXSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgYSBsaXN0IG9mIHN1Z2dlc3Rpb25zIGZvciBhIG1pc3NwZWxsZWQgd29yZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHNlZSBodHRwOi8vd3d3Lm5vcnZpZy5jb20vc3BlbGwtY29ycmVjdC5odG1sIGZvciB0aGUgYmFzaXMgb2YgdGhpcyBzdWdnZXN0b3IuXG4gICAgICAgICAqIFRoaXMgc3VnZ2VzdG9yIGlzIHByaW1pdGl2ZSwgYnV0IGl0IHdvcmtzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gd29yZCBUaGUgbWlzc3BlbGxpbmcuXG4gICAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbGltaXQ9NV0gVGhlIG1heGltdW0gbnVtYmVyIG9mIHN1Z2dlc3Rpb25zIHRvIHJldHVybi5cbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ1tdfSBUaGUgYXJyYXkgb2Ygc3VnZ2VzdGlvbnMuXG4gICAgICAgICAqL1xuICAgICAgICBhbHBoYWJldDogXCJcIixcbiAgICAgICAgc3VnZ2VzdDogZnVuY3Rpb24gKHdvcmQsIGxpbWl0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMubG9hZGVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJEaWN0aW9uYXJ5IG5vdCBsb2FkZWQuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsaW1pdCA9IGxpbWl0IHx8IDU7XG4gICAgICAgICAgICBpZiAodGhpcy5tZW1vaXplZC5oYXNPd25Qcm9wZXJ0eSh3b3JkKSkge1xuICAgICAgICAgICAgICAgIHZhciBtZW1vaXplZExpbWl0ID0gdGhpcy5tZW1vaXplZFt3b3JkXVsnbGltaXQnXTtcbiAgICAgICAgICAgICAgICAvLyBPbmx5IHJldHVybiB0aGUgY2FjaGVkIGxpc3QgaWYgaXQncyBiaWcgZW5vdWdoIG9yIGlmIHRoZXJlIHdlcmVuJ3QgZW5vdWdoIHN1Z2dlc3Rpb25zXG4gICAgICAgICAgICAgICAgLy8gdG8gZmlsbCBhIHNtYWxsZXIgbGltaXQuXG4gICAgICAgICAgICAgICAgaWYgKGxpbWl0IDw9IG1lbW9pemVkTGltaXQgfHwgdGhpcy5tZW1vaXplZFt3b3JkXVsnc3VnZ2VzdGlvbnMnXS5sZW5ndGggPCBtZW1vaXplZExpbWl0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1lbW9pemVkW3dvcmRdWydzdWdnZXN0aW9ucyddLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5jaGVjayh3b3JkKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgcmVwbGFjZW1lbnQgdGFibGUuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgX2xlbiA9IHRoaXMucmVwbGFjZW1lbnRUYWJsZS5sZW5ndGg7IGkgPCBfbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVwbGFjZW1lbnRFbnRyeSA9IHRoaXMucmVwbGFjZW1lbnRUYWJsZVtpXTtcbiAgICAgICAgICAgICAgICBpZiAod29yZC5pbmRleE9mKHJlcGxhY2VtZW50RW50cnlbMF0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY29ycmVjdGVkV29yZCA9IHdvcmQucmVwbGFjZShyZXBsYWNlbWVudEVudHJ5WzBdLCByZXBsYWNlbWVudEVudHJ5WzFdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY2hlY2soY29ycmVjdGVkV29yZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBbY29ycmVjdGVkV29yZF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuYWxwaGFiZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBVc2UgdGhlIEVuZ2xpc2ggYWxwaGFiZXQgYXMgdGhlIGRlZmF1bHQuIFByb2JsZW1hdGljLCBidXQgYmFja3dhcmRzLWNvbXBhdGlibGUuXG4gICAgICAgICAgICAgICAgdGhpcy5hbHBoYWJldCA9ICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaJztcbiAgICAgICAgICAgICAgICAvLyBBbnkgY2hhcmFjdGVycyBkZWZpbmVkIGluIHRoZSBhZmZpeCBmaWxlIGFzIHN1YnN0aXR1dGlvbnMgY2FuIGdvIGluIHRoZSBhbHBoYWJldCB0b28uXG4gICAgICAgICAgICAgICAgLy8gTm90ZSB0aGF0IGRpY3Rpb25hcmllcyBkbyBub3QgaW5jbHVkZSB0aGUgZW50aXJlIGFscGhhYmV0IGluIHRoZSBUUlkgZmxhZyB3aGVuIGl0J3MgdGhlcmUuXG4gICAgICAgICAgICAgICAgLy8gRm9yIGV4YW1wbGUsIFEgaXMgbm90IGluIHRoZSBkZWZhdWx0IEVuZ2xpc2ggVFJZIGxpc3Q7IHRoYXQncyB3aHkgaGF2aW5nIHRoZSBkZWZhdWx0XG4gICAgICAgICAgICAgICAgLy8gYWxwaGFiZXQgYWJvdmUgaXMgdXNlZnVsLlxuICAgICAgICAgICAgICAgIGlmICgnVFJZJyBpbiB0aGlzLmZsYWdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWxwaGFiZXQgKz0gdGhpcy5mbGFnc1snVFJZJ107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFBsdXMgYW55IGFkZGl0aW9uYWwgY2hhcmFjdGVycyBzcGVjaWZpY2FsbHkgZGVmaW5lZCBhcyBiZWluZyBhbGxvd2VkIGluIHdvcmRzLlxuICAgICAgICAgICAgICAgIGlmICgnV09SRENIQVJTJyBpbiB0aGlzLmZsYWdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWxwaGFiZXQgKz0gdGhpcy5mbGFnc1snV09SRENIQVJTJ107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhbnkgZHVwbGljYXRlcy5cbiAgICAgICAgICAgICAgICB2YXIgYWxwaGFBcnJheSA9IHRoaXMuYWxwaGFiZXQuc3BsaXQoXCJcIik7XG4gICAgICAgICAgICAgICAgYWxwaGFBcnJheS5zb3J0KCk7XG4gICAgICAgICAgICAgICAgdmFyIGFscGhhSGFzaCA9IHt9O1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYWxwaGFBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBhbHBoYUhhc2hbYWxwaGFBcnJheVtpXV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmFscGhhYmV0ID0gJyc7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBhbHBoYUhhc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbHBoYWJldCArPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUmV0dXJucyBhIGhhc2gga2V5ZWQgYnkgYWxsIG9mIHRoZSBzdHJpbmdzIHRoYXQgY2FuIGJlIG1hZGUgYnkgbWFraW5nIGEgc2luZ2xlIGVkaXQgdG8gdGhlIHdvcmQgKG9yIHdvcmRzIGluKSBgd29yZHNgXG4gICAgICAgICAgICAgKiBUaGUgdmFsdWUgb2YgZWFjaCBlbnRyeSBpcyB0aGUgbnVtYmVyIG9mIHVuaXF1ZSB3YXlzIHRoYXQgdGhlIHJlc3VsdGluZyB3b3JkIGNhbiBiZSBtYWRlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBhcmcgSGFzaE1hcCB3b3JkcyBBIGhhc2gga2V5ZWQgYnkgd29yZHMgKGFsbCB3aXRoIHRoZSB2YWx1ZSBgdHJ1ZWAgdG8gbWFrZSBsb29rdXBzIHZlcnkgcXVpY2spLlxuICAgICAgICAgICAgICogQGFyZyBib29sZWFuIGtub3duX29ubHkgV2hldGhlciB0aGlzIGZ1bmN0aW9uIHNob3VsZCBpZ25vcmUgc3RyaW5ncyB0aGF0IGFyZSBub3QgaW4gdGhlIGRpY3Rpb25hcnkuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGZ1bmN0aW9uIGVkaXRzMSh3b3Jkcywga25vd25fb25seSkge1xuICAgICAgICAgICAgICAgIHZhciBydiA9IHt9O1xuICAgICAgICAgICAgICAgIHZhciBpLCBqLCBfaWlsZW4sIF9sZW4sIF9qbGVuLCBfZWRpdDtcbiAgICAgICAgICAgICAgICB2YXIgYWxwaGFiZXRMZW5ndGggPSBzZWxmLmFscGhhYmV0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciB3b3JkXzEgaW4gd29yZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMCwgX2xlbiA9IHdvcmRfMS5sZW5ndGggKyAxOyBpIDwgX2xlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcyA9IFt3b3JkXzEuc3Vic3RyaW5nKDAsIGkpLCB3b3JkXzEuc3Vic3RyaW5nKGkpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhIGxldHRlci5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2VkaXQgPSBzWzBdICsgc1sxXS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFrbm93bl9vbmx5IHx8IHNlbGYuY2hlY2soX2VkaXQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghKF9lZGl0IGluIHJ2KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnZbX2VkaXRdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ2W19lZGl0XSArPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJhbnNwb3NlIGxldHRlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVsaW1pbmF0ZSB0cmFuc3Bvc2l0aW9ucyBvZiBpZGVudGljYWwgbGV0dGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNbMV0ubGVuZ3RoID4gMSAmJiBzWzFdWzFdICE9PSBzWzFdWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2VkaXQgPSBzWzBdICsgc1sxXVsxXSArIHNbMV1bMF0gKyBzWzFdLnN1YnN0cmluZygyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWtub3duX29ubHkgfHwgc2VsZi5jaGVjayhfZWRpdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoX2VkaXQgaW4gcnYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydltfZWRpdF0gPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnZbX2VkaXRdICs9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc1sxXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlcGxhY2UgYSBsZXR0ZXIgd2l0aCBhbm90aGVyIGxldHRlci5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGV0dGVyY2FzZSA9IChzWzFdLnN1YnN0cmluZygwLCAxKS50b1VwcGVyQ2FzZSgpID09PSBzWzFdLnN1YnN0cmluZygwLCAxKSkgPyAndXBwZXJjYXNlJyA6ICdsb3dlcmNhc2UnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBhbHBoYWJldExlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlbWVudExldHRlciA9IHNlbGYuYWxwaGFiZXRbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNldCB0aGUgY2FzZSBvZiB0aGUgcmVwbGFjZW1lbnQgbGV0dGVyIHRvIHRoZSBzYW1lIGFzIHRoZSBsZXR0ZXIgYmVpbmcgcmVwbGFjZWQuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgndXBwZXJjYXNlJyA9PT0gbGV0dGVyY2FzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZW1lbnRMZXR0ZXIgPSByZXBsYWNlbWVudExldHRlci50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVsaW1pbmF0ZSByZXBsYWNlbWVudCBvZiBhIGxldHRlciBieSBpdHNlbGZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VtZW50TGV0dGVyICE9IHNbMV0uc3Vic3RyaW5nKDAsIDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfZWRpdCA9IHNbMF0gKyByZXBsYWNlbWVudExldHRlciArIHNbMV0uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFrbm93bl9vbmx5IHx8IHNlbGYuY2hlY2soX2VkaXQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoX2VkaXQgaW4gcnYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ2W19lZGl0XSA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydltfZWRpdF0gKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc1sxXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFkZCBhIGxldHRlciBiZXR3ZWVuIGVhY2ggbGV0dGVyLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBhbHBoYWJldExlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBsZXR0ZXJzIG9uIGVhY2ggc2lkZSBhcmUgY2FwaXRhbGl6ZWQsIGNhcGl0YWxpemUgdGhlIHJlcGxhY2VtZW50LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGV0dGVyY2FzZSA9IChzWzBdLnN1YnN0cmluZygtMSkudG9VcHBlckNhc2UoKSA9PT0gc1swXS5zdWJzdHJpbmcoLTEpICYmIHNbMV0uc3Vic3RyaW5nKDAsIDEpLnRvVXBwZXJDYXNlKCkgPT09IHNbMV0uc3Vic3RyaW5nKDAsIDEpKSA/ICd1cHBlcmNhc2UnIDogJ2xvd2VyY2FzZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlbWVudExldHRlciA9IHNlbGYuYWxwaGFiZXRbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgndXBwZXJjYXNlJyA9PT0gbGV0dGVyY2FzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZW1lbnRMZXR0ZXIgPSByZXBsYWNlbWVudExldHRlci50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9lZGl0ID0gc1swXSArIHJlcGxhY2VtZW50TGV0dGVyICsgc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFrbm93bl9vbmx5IHx8IHNlbGYuY2hlY2soX2VkaXQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShfZWRpdCBpbiBydikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydltfZWRpdF0gPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnZbX2VkaXRdICs9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJ2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnVuY3Rpb24gY29ycmVjdCh3b3JkKSB7XG4gICAgICAgICAgICAgICAgdmFyIF9hO1xuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgZWRpdC1kaXN0YW5jZS0xIGFuZCBlZGl0LWRpc3RhbmNlLTIgZm9ybXMgb2YgdGhpcyB3b3JkLlxuICAgICAgICAgICAgICAgIHZhciBlZDEgPSBlZGl0czEoKF9hID0ge30sIF9hW3dvcmRdID0gdHJ1ZSwgX2EpKTtcbiAgICAgICAgICAgICAgICB2YXIgZWQyID0gZWRpdHMxKGVkMSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgLy8gU29ydCB0aGUgZWRpdHMgYmFzZWQgb24gaG93IG1hbnkgZGlmZmVyZW50IHdheXMgdGhleSB3ZXJlIGNyZWF0ZWQuXG4gICAgICAgICAgICAgICAgdmFyIHdlaWdodGVkX2NvcnJlY3Rpb25zID0gZWQyO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGVkMXdvcmQgaW4gZWQxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2VsZi5jaGVjayhlZDF3b3JkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGVkMXdvcmQgaW4gd2VpZ2h0ZWRfY29ycmVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdlaWdodGVkX2NvcnJlY3Rpb25zW2VkMXdvcmRdICs9IGVkMVtlZDF3b3JkXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdlaWdodGVkX2NvcnJlY3Rpb25zW2VkMXdvcmRdID0gZWQxW2VkMXdvcmRdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBpLCBfbGVuO1xuICAgICAgICAgICAgICAgIHZhciBzb3J0ZWRfY29ycmVjdGlvbnMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGkgaW4gd2VpZ2h0ZWRfY29ycmVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdlaWdodGVkX2NvcnJlY3Rpb25zLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3J0ZWRfY29ycmVjdGlvbnMucHVzaChbaSwgd2VpZ2h0ZWRfY29ycmVjdGlvbnNbaV1dKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBzb3J0ZXIoYSwgYikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYV92YWwgPSBhWzFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYl92YWwgPSBiWzFdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYV92YWwgPCBiX3ZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGFfdmFsID4gYl92YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIEB0b2RvIElmIGEgYW5kIGIgYXJlIGVxdWFsbHkgd2VpZ2h0ZWQsIGFkZCBvdXIgb3duIHdlaWdodCBiYXNlZCBvbiBzb21ldGhpbmcgbGlrZSB0aGUga2V5IGxvY2F0aW9ucyBvbiB0aGlzIGxhbmd1YWdlJ3MgZGVmYXVsdCBrZXlib2FyZC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJbMF0ubG9jYWxlQ29tcGFyZShhWzBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc29ydGVkX2NvcnJlY3Rpb25zLnNvcnQoc29ydGVyKS5yZXZlcnNlKCk7XG4gICAgICAgICAgICAgICAgdmFyIHJ2ID0gW107XG4gICAgICAgICAgICAgICAgdmFyIGNhcGl0YWxpemF0aW9uX3NjaGVtZSA9IFwibG93ZXJjYXNlXCI7XG4gICAgICAgICAgICAgICAgaWYgKHdvcmQudG9VcHBlckNhc2UoKSA9PT0gd29yZCkge1xuICAgICAgICAgICAgICAgICAgICBjYXBpdGFsaXphdGlvbl9zY2hlbWUgPSBcInVwcGVyY2FzZVwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh3b3JkLnN1YnN0cigwLCAxKS50b1VwcGVyQ2FzZSgpICsgd29yZC5zdWJzdHIoMSkudG9Mb3dlckNhc2UoKSA9PT0gd29yZCkge1xuICAgICAgICAgICAgICAgICAgICBjYXBpdGFsaXphdGlvbl9zY2hlbWUgPSBcImNhcGl0YWxpemVkXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciB3b3JraW5nX2xpbWl0ID0gbGltaXQ7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IE1hdGgubWluKHdvcmtpbmdfbGltaXQsIHNvcnRlZF9jb3JyZWN0aW9ucy5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFwidXBwZXJjYXNlXCIgPT09IGNhcGl0YWxpemF0aW9uX3NjaGVtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc29ydGVkX2NvcnJlY3Rpb25zW2ldWzBdID0gc29ydGVkX2NvcnJlY3Rpb25zW2ldWzBdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoXCJjYXBpdGFsaXplZFwiID09PSBjYXBpdGFsaXphdGlvbl9zY2hlbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvcnRlZF9jb3JyZWN0aW9uc1tpXVswXSA9IHNvcnRlZF9jb3JyZWN0aW9uc1tpXVswXS5zdWJzdHIoMCwgMSkudG9VcHBlckNhc2UoKSArIHNvcnRlZF9jb3JyZWN0aW9uc1tpXVswXS5zdWJzdHIoMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmhhc0ZsYWcoc29ydGVkX2NvcnJlY3Rpb25zW2ldWzBdLCBcIk5PU1VHR0VTVFwiKSAmJiBydi5pbmRleE9mKHNvcnRlZF9jb3JyZWN0aW9uc1tpXVswXSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBydi5wdXNoKHNvcnRlZF9jb3JyZWN0aW9uc1tpXVswXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBvbmUgb2YgdGhlIGNvcnJlY3Rpb25zIGlzIG5vdCBlbGlnaWJsZSBhcyBhIHN1Z2dlc3Rpb24gLCBtYWtlIHN1cmUgd2Ugc3RpbGwgcmV0dXJuIHRoZSByaWdodCBudW1iZXIgb2Ygc3VnZ2VzdGlvbnMuXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JraW5nX2xpbWl0Kys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJ2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5tZW1vaXplZFt3b3JkXSA9IHtcbiAgICAgICAgICAgICAgICAnc3VnZ2VzdGlvbnMnOiBjb3JyZWN0KHdvcmQpLFxuICAgICAgICAgICAgICAgICdsaW1pdCc6IGxpbWl0XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWVtb2l6ZWRbd29yZF1bJ3N1Z2dlc3Rpb25zJ107XG4gICAgICAgIH1cbiAgICB9O1xufSkoKTtcbi8vIFN1cHBvcnQgZm9yIHVzZSBhcyBhIG5vZGUuanMgbW9kdWxlLlxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBUeXBvO1xufVxuIiwiLy8gVXNlIHN0cmljdCBtb2RlIChodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9TdHJpY3RfbW9kZSlcblwidXNlIHN0cmljdFwiO1xuXG5cbi8vIFJlcXVpcmVzXG52YXIgVHlwbyA9IHJlcXVpcmUoXCJ0eXBvLWpzXCIpO1xuXG5cbi8vIENyZWF0ZSBmdW5jdGlvblxuZnVuY3Rpb24gQ29kZU1pcnJvclNwZWxsQ2hlY2tlcihvcHRpb25zKSB7XG5cdC8vIEluaXRpYWxpemVcblx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdG9wdGlvbnMubGFuZ3VhZ2UgPSBvcHRpb25zLmxhbmd1YWdlIHx8IFwiZW5fVVNcIjtcblx0b3B0aW9ucy51cmxBZmYgPSBvcHRpb25zLnVybEFmZiB8fCBcImh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9jb2RlbWlycm9yLnNwZWxsLWNoZWNrZXIvbGF0ZXN0L2VuX1VTLmFmZlwiO1xuXHRvcHRpb25zLnVybERpYyA9IG9wdGlvbnMudXJsRGljIHx8IFwiaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L2NvZGVtaXJyb3Iuc3BlbGwtY2hlY2tlci9sYXRlc3QvZW5fVVMuZGljXCI7XG5cblxuXHQvLyBWZXJpZnlcblx0aWYodHlwZW9mIG9wdGlvbnMuY29kZU1pcnJvckluc3RhbmNlICE9PSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIG9wdGlvbnMuY29kZU1pcnJvckluc3RhbmNlLmRlZmluZU1vZGUgIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdGNvbnNvbGUubG9nKFwiQ29kZU1pcnJvciBTcGVsbCBDaGVja2VyOiBZb3UgbXVzdCBwcm92aWRlIGFuIGluc3RhbmNlIG9mIENvZGVNaXJyb3IgdmlhIHRoZSBvcHRpb24gYGNvZGVNaXJyb3JJbnN0YW5jZWBcIik7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblxuXHQvLyBCZWNhdXNlIHNvbWUgYnJvd3NlcnMgZG9uJ3Qgc3VwcG9ydCB0aGlzIGZ1bmN0aW9uYWxpdHkgeWV0XG5cdGlmKCFTdHJpbmcucHJvdG90eXBlLmluY2x1ZGVzKSB7XG5cdFx0U3RyaW5nLnByb3RvdHlwZS5pbmNsdWRlcyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFx0XHRyZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgIT09IC0xO1xuXHRcdH07XG5cdH1cblxuXG5cdC8vIERlZmluZSB0aGUgbmV3IG1vZGVcblx0b3B0aW9ucy5jb2RlTWlycm9ySW5zdGFuY2UuZGVmaW5lTW9kZShcInNwZWxsLWNoZWNrZXJcIiwgZnVuY3Rpb24oY29uZmlnKSB7XG5cdFx0Ly8gTG9hZCBBRkYvRElDIGRhdGFcblx0XHRpZighQ29kZU1pcnJvclNwZWxsQ2hlY2tlci5hZmZfbG9hZGluZykge1xuXHRcdFx0Q29kZU1pcnJvclNwZWxsQ2hlY2tlci5hZmZfbG9hZGluZyA9IHRydWU7XG5cdFx0XHR2YXIgeGhyX2FmZiA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0eGhyX2FmZi5vcGVuKFwiR0VUXCIsIG9wdGlvbnMudXJsQWZmLCB0cnVlKTtcblx0XHRcdHhocl9hZmYub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmKHhocl9hZmYucmVhZHlTdGF0ZSA9PT0gNCAmJiB4aHJfYWZmLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0Q29kZU1pcnJvclNwZWxsQ2hlY2tlci5hZmZfZGF0YSA9IHhocl9hZmYucmVzcG9uc2VUZXh0O1xuXHRcdFx0XHRcdENvZGVNaXJyb3JTcGVsbENoZWNrZXIubnVtX2xvYWRlZCsrO1xuXG5cdFx0XHRcdFx0aWYoQ29kZU1pcnJvclNwZWxsQ2hlY2tlci5udW1fbG9hZGVkID09IDIpIHtcblx0XHRcdFx0XHRcdENvZGVNaXJyb3JTcGVsbENoZWNrZXIudHlwbyA9IG5ldyBUeXBvKG9wdGlvbnMubGFuZ3VhZ2UsIENvZGVNaXJyb3JTcGVsbENoZWNrZXIuYWZmX2RhdGEsIENvZGVNaXJyb3JTcGVsbENoZWNrZXIuZGljX2RhdGEsIHtcblx0XHRcdFx0XHRcdFx0cGxhdGZvcm06IFwiYW55XCJcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHhocl9hZmYuc2VuZChudWxsKTtcblx0XHR9XG5cblx0XHRpZighQ29kZU1pcnJvclNwZWxsQ2hlY2tlci5kaWNfbG9hZGluZykge1xuXHRcdFx0Q29kZU1pcnJvclNwZWxsQ2hlY2tlci5kaWNfbG9hZGluZyA9IHRydWU7XG5cdFx0XHR2YXIgeGhyX2RpYyA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0eGhyX2RpYy5vcGVuKFwiR0VUXCIsIG9wdGlvbnMudXJsRGljLCB0cnVlKTtcblx0XHRcdHhocl9kaWMub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmKHhocl9kaWMucmVhZHlTdGF0ZSA9PT0gNCAmJiB4aHJfZGljLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0Q29kZU1pcnJvclNwZWxsQ2hlY2tlci5kaWNfZGF0YSA9IHhocl9kaWMucmVzcG9uc2VUZXh0O1xuXHRcdFx0XHRcdENvZGVNaXJyb3JTcGVsbENoZWNrZXIubnVtX2xvYWRlZCsrO1xuXG5cdFx0XHRcdFx0aWYoQ29kZU1pcnJvclNwZWxsQ2hlY2tlci5udW1fbG9hZGVkID09IDIpIHtcblx0XHRcdFx0XHRcdENvZGVNaXJyb3JTcGVsbENoZWNrZXIudHlwbyA9IG5ldyBUeXBvKG9wdGlvbnMubGFuZ3VhZ2UsIENvZGVNaXJyb3JTcGVsbENoZWNrZXIuYWZmX2RhdGEsIENvZGVNaXJyb3JTcGVsbENoZWNrZXIuZGljX2RhdGEsIHtcblx0XHRcdFx0XHRcdFx0cGxhdGZvcm06IFwiYW55XCJcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHhocl9kaWMuc2VuZChudWxsKTtcblx0XHR9XG5cblxuXHRcdC8vIERlZmluZSB3aGF0IHNlcGFyYXRlcyBhIHdvcmRcblx0XHR2YXIgcnhfd29yZCA9IFwiIVxcXCIjJCUmKCkqKywtLi86Ozw9Pj9AW1xcXFxdXl9ge3x9fiBcXHRcXHJcXG5cIjtcblxuXG5cdFx0Ly8gQ3JlYXRlIHRoZSBvdmVybGF5IGFuZCBzdWNoXG5cdFx0dmFyIG92ZXJsYXkgPSB7XG5cdFx0XHR0b2tlbjogZnVuY3Rpb24oc3RyZWFtKSB7XG5cdFx0XHRcdHZhciBjaCA9IHN0cmVhbS5wZWVrKCk7XG5cdFx0XHRcdHZhciB3b3JkID0gXCJcIjtcblxuXHRcdFx0XHRpZihyeF93b3JkLmluY2x1ZGVzKGNoKSkge1xuXHRcdFx0XHRcdHN0cmVhbS5uZXh0KCk7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR3aGlsZSgoY2ggPSBzdHJlYW0ucGVlaygpKSAhPSBudWxsICYmICFyeF93b3JkLmluY2x1ZGVzKGNoKSkge1xuXHRcdFx0XHRcdHdvcmQgKz0gY2g7XG5cdFx0XHRcdFx0c3RyZWFtLm5leHQoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmKENvZGVNaXJyb3JTcGVsbENoZWNrZXIudHlwbyAmJiAhQ29kZU1pcnJvclNwZWxsQ2hlY2tlci50eXBvLmNoZWNrKHdvcmQpKVxuXHRcdFx0XHRcdHJldHVybiBcInNwZWxsLWVycm9yXCI7IC8vIENTUyBjbGFzczogY20tc3BlbGwtZXJyb3JcblxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dmFyIG1vZGUgPSBvcHRpb25zLmNvZGVNaXJyb3JJbnN0YW5jZS5nZXRNb2RlKFxuXHRcdFx0Y29uZmlnLCBjb25maWcuYmFja2Ryb3AgfHwgXCJ0ZXh0L3BsYWluXCJcblx0XHQpO1xuXG5cdFx0cmV0dXJuIG9wdGlvbnMuY29kZU1pcnJvckluc3RhbmNlLm92ZXJsYXlNb2RlKG1vZGUsIG92ZXJsYXksIHRydWUpO1xuXHR9KTtcbn1cblxuXG4vLyBJbml0aWFsaXplIGRhdGEgZ2xvYmFsbHkgdG8gcmVkdWNlIG1lbW9yeSBjb25zdW1wdGlvblxuQ29kZU1pcnJvclNwZWxsQ2hlY2tlci5udW1fbG9hZGVkID0gMDtcbkNvZGVNaXJyb3JTcGVsbENoZWNrZXIuYWZmX2xvYWRpbmcgPSBmYWxzZTtcbkNvZGVNaXJyb3JTcGVsbENoZWNrZXIuZGljX2xvYWRpbmcgPSBmYWxzZTtcbkNvZGVNaXJyb3JTcGVsbENoZWNrZXIuYWZmX2RhdGEgPSBcIlwiO1xuQ29kZU1pcnJvclNwZWxsQ2hlY2tlci5kaWNfZGF0YSA9IFwiXCI7XG5Db2RlTWlycm9yU3BlbGxDaGVja2VyLnR5cG87XG5cblxuLy8gRXhwb3J0XG5tb2R1bGUuZXhwb3J0cyA9IENvZGVNaXJyb3JTcGVsbENoZWNrZXI7Il19
