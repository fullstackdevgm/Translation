#!/usr/bin/env node

// Libraries needed
const async         = require('async')
const chalk         = require('chalk')
const clear         = require('clear')
const CLI           = require('clui')
const Configstore   = require('configstore')
const figlet        = require('figlet')
const fs            = require('fs')
const inquirer      = require('inquirer')
const path          = require('path')
const pkg           = require('./package.json')

const conf          = new Configstore(pkg.name)
const Spinner       = CLI.Spinner

// Our Libraries
const TranslationMemory = require('./lib/translation-memory')


// const AppAction = {
//     wordCount:                  'wordCount',
//     fileTidy:                   'fileTidy',
//     extractUITranslation:       'extractUITranslation',
//     addUITranslation:           'addUITranslation',
//     addUISource:                'addUISource',
//     extractSourceTranslation:   'extractSourceTranslation',
//     addSource:                  'addSource',
//     addTranslation:             'addTranslation'
// }

const AppAction = {
    extractForTranslation:          'extractForTranslation',
    importNewTranslations:          'importNewTranslations',
    androidImportBaseXML:           'androidImportBaseXML',
    androidBuildTranslations:       'androidBuildTranslations',

    searchSources:                  'searchSources',
    searchForTranslation:           'searchForTranslation'
}

const TranslationMemoryFileName = 'appigo-translations.sqlitedb'

// Main script begins here

// This is intentionally hard-coded
var tm = null

clear()
console.log(
    chalk.blueBright(
        figlet.textSync('Todo Translation', { horizontalLayout: 'full'})
    )
)

async.waterfall([
    function(callback) {
        tm = new TranslationMemory(TranslationMemoryFileName)
        callback(null)
    },
    function(callback) {
        // Present main menu
        var showMainMenu = true
        async.whilst(function() {
            return showMainMenu
        }, function(whilstCallback) {
            runMainMenu(function(err, shouldExit) {
                if (err) {
                    whilstCallback(err)
                } else {
                    showMainMenu = !shouldExit
                    whilstCallback(null)
                }
            })
        }, function(err) {
            callback(err)
        })
    },
    function(callback) {
        // All done!
        tm.close()
        process.exit(0)
    }
],
function(err) {
    if (err) {
        console.log(`An error occurred: ${err}`)
        tm.close()
        process.exit(1)
    }
})

function runMainMenu(completion) {
    const options = [
        {
            type: 'rawlist',
            name: 'menuSelection',
            pageSize: 20,
            message: 'What do you want to do?',
            choices: [
                new inquirer.Separator('---- ANDROID ----'),
                { name: 'Import base (English) XML File', value: AppAction.androidImportBaseXML },
                { name: 'Build translated XML Files', value: AppAction.androidBuildTranslations },
                new inquirer.Separator('------ IOS ------'),
                { name: 'Not implemented yet', value: 'not-implemented'},
                new inquirer.Separator('------ MAC ------'),
                { name: 'Not implemented yet', value: 'not-implemented'},
                new inquirer.Separator(),
                { name: 'Extract strings for translation', value: AppAction.extractForTranslation },
                { name: 'Import new translated strings', value: AppAction.importNewTranslations },
                { name: 'Search source strings', value: AppAction.searchSources },
                { name: 'Search for a translation', value: AppAction.searchForTranslation },
                new inquirer.Separator(),
                { name: 'Exit', value: 'exit' }
            ]
        }
    ]
    inquirer.prompt(options)
    .then(answer => {
        var shouldExitApp = answer.menuSelection == 'exit'
        if (shouldExitApp) {
            completion(null, shouldExitApp)
            return
        }
        runAction(answer.menuSelection, function(err, success) {
            if (err) {
                completion(err)
            } else {
                completion(null, false) // Don't exit, but return to the main menu
            }
        })
    })
    .catch(reason => {
        console.log(`Error selecting main menu item: ${reason}`)
        process.exit(1)
    })
}

function runAction(actionName, completion) {
    if (actionName == AppAction.searchSources) {
        searchSources(function(err, result) {
            completion(err, result)
        })
    } else if (actionName == AppAction.searchForTranslation) {
        searchForTranslation(function(err, result) {
            completion(err, result)
        })
    } else {
        console.log(`TODO: Implement the action for: ${actionName}`)
        completion(null, true)
    }
}

function searchSources(completion) {
    async.waterfall([
        function(callback) {
            // Prompt the user for a search term
            const options = [
                {
                    name: 'searchTerm',
                    type: 'input',
                    message: 'Enter a string to search for:'
                }
            ]
            inquirer.prompt(options)
            .then(answer => {
                let trimmedSearchTerm = answer.searchTerm.trim()
                callback(null, trimmedSearchTerm)
            })
            .catch(reason => {
                console.log(`Error getting search term: ${reason}`)
                process.exit(1)
            })
        },
        function(searchTerm, callback) {
            if (searchTerm.length == 0) {
                callback(null, true)
            } else {
                let results = tm.searchSources(searchTerm)
                console.log(`Search Results:`)
                results.forEach(result => {
                    console.log(result.source)
                })

                callback(null, true)
            }
        }
    ], function(err, success) {
        completion(err, success)
    })
}


function searchForTranslation(completion) {
    async.waterfall([
        function(callback) {
            // Prompt the user for a search term
            const options = [
                {
                    name: 'searchTerm',
                    type: 'input',
                    message: 'Enter a string to search for:'
                }
            ]
            inquirer.prompt(options)
            .then(answer => {
                let trimmedSearchTerm = answer.searchTerm.trim()
                callback(null, trimmedSearchTerm)
            })
            .catch(reason => {
                console.log(`Error getting search term: ${reason}`)
                process.exit(1)
            })
        },
        function(searchTerm, callback) {
            if (searchTerm.length == 0) {
                callback(null, true)
            } else {
                let results = tm.searchTranslations(searchTerm)
                console.log(`Search Results:`)
                results.forEach(result => {
                    console.log(`\nSource: ${result.source}`)
                    console.log(`Translations:`)
                    result.translations.forEach(translation => {
                        console.log(`${translation.language}: ${translation.translation}`)
                    })
                })

                callback(null, true)
            }
        }
    ], function(err, success) {
        completion(err, success)
    })
}
