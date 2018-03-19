'use strict'

const chalk         = require('chalk')
const Database      = require('better-sqlite3')
const uuidV4        = require('uuid/v4')

const SupportedLanguages = [
    {
        language: "English",
        code: "en"
    },
    {
        language: "Spanish",
        code: "es"
    },
    {
        language: "German",
        code: "de"
    },
    {
        language: "French",
        code: "fr"
    },
    {
        language: "Italian",
        code: "it"
    },
    {
        language: "Japanese",
        code: "ja"
    },
    {
        language: "Portuguese",
        code: "pt"
    },
    {
        language: "Russian",
        code: "ru"
    },
    {
        language: "Simplified Chinese",
        code: "zh_CN"
    },
    {
        language: "Traditional Chinese",
        code: "de"
    }
]

// Private functions not exposed outside the class
function _prepareDatabase(db) {
    // Make sure the database has all of the needed tables
    db.prepare('CREATE TABLE IF NOT EXISTS sources (guid TEXT PRIMARY KEY, source TEXT);').run()
    db.prepare('CREATE TABLE IF NOT EXISTS comments (guid TEXT, source_guid TEXT, comment TEXT);').run()
    db.prepare('CREATE TABLE IF NOT EXISTS translations (source_guid TEXT, lang TEXT, translation TEXT, PRIMARY KEY(source_guid, lang));').run()
}

function _printDatabaseStats(db) {
    console.log(chalk.default.greenBright(`Database Statistics:`))
    const numOfSources = db.prepare('SELECT COUNT(*) FROM sources').pluck().get()
    console.log(chalk.default.greenBright(`\tNumber of sources: ${numOfSources}`))
}

class TranslationMemory {
    constructor(dbFileName) {
        console.log(chalk.default.greenBright(`Loading translation memory from: ${dbFileName}`))
        this.db = Database(dbFileName)
        _prepareDatabase(this.db)
        _printDatabaseStats(this.db)
    }
    
    //
    // Utility Methods
    //

    get isOpen() {
        if (!this.db) { return false }
        return this.db.open
    }

    close() {
        if (this.isOpen) {
            this.db.close()
        }
    }

    //
    // Functionality Methods
    //

    /**
     * Adds a base source string into the translation memory database.
     * @param {string} sourceString The base language (English) source string.
     * @param {[string]} commentsArray An array of strings that represent the comments about the source string. These comment strings give translators extra context about what the string is used for.
     * @returns {string} Returns the GUID of the new source string or null if there was an error.
     */
    addSource(sourceString, commentsArray) {
        if (sourceString == null || commentsArray == null) {
            console.error(`TranslationMemory.addSource() called with null sourceString or commentsArray.`)
            return null
        }

        // If the sourceString already exists in the database, just update the comments.
        let existingGUID = this.guidForSource(sourceString)
        if (existingGUID) {
            this.addComments(commentsArray, existingGUID)
            return existingGUID
        }

        // Add a new source
        let uuid = uuidV4()

        // If this project ever grows bigger (beyond Appigo), adding
        // the source and comments should be wrapped in a transaction.
        this.db.prepare('INSERT INTO sources (guid, source) VALUES (?, ?)').run([uuid, sourceString])
        
        this.addComments(uuid, commentsArray)

        return uuid
    }

    /**
     * Get the GUID of a sourceString.
     * @param {string} sourceString The base language string.
     * @returns {string} The GUID of the corresponding sourceString or null if the sourceString is not found in the translation memory.
     */
    guidForSource(sourceString) {
        if (sourceString == null) {
            console.error(`TranslationMemory.guidForSource() called with null sourceString.`)
            return null
        }

        const guid = db.prepare('SELECT guid FROM sources WHERE source = ?').pluck().get(sourceString)
        return guid
    }
    
    /**
     * Get the source string for a GUID.
     * @param {string} sourceGUID The GUID for a base language source string.
     * @returns {string} The source string for the corresponding GUID or null if the GUID is not found in the translation memory.
     */
    sourceForGUID(sourceGUID) {
        if (sourceString == null) {
            console.error(`TranslationMemory.sourceForGUID() called with null sourceGUID.`)
            return null
        }

        const source = db.prepare('SELECT source FROM sources WHERE guid = ?').pluck().get(sourceGUID)
        return source
    }

    /**
     * Get the comments of a source string. 
     * @param {string} sourceString The base language string.
     * @returns {[string]} Returns an array of comments for the specified sourceString. If the sourceString is not found, this returns an empty array.
     */
    commentsForSource(sourceString) {
        if (sourceString == null) {
            console.error(`TranslationMemory.commentsForSource() called with null sourceString.`)
            return null
        }

        let sourceGUID = this.guidForSource(sourceString)
        if (!sourceGUID) {
            console.error(`TranslationMemory.commentsForSource() could not find source string: ${sourceString}`)
            return null
        }

        return this.commentsForSourceGUID(sourceGUID)
    }

    /**
     * Get the comments for a GUID.
     * @param {string} sourceGUID The GUID for a base language source string.
     * @returns {[string]} Returns an array of comments for the specified sourceGUID. If the sourceGUID is not found, this returns an empty array.
     */
    commentsForSourceGUID(sourceGUID) {
        if (sourceGUID == null) {
            console.error(`TranslationMemory.commentsForSourceGUID() called with null sourceGUID.`)
            return null
        }

        let comments = this.db.prepare("SELECT comment FROM comments WHERE source_guid = ?").all(sourceGUID)
        if (!comments) {
            return []
        }

        return comments.map(row => {
            return row.comment
        })
    }

    /**
     * Add comments to a base language source string.
     * @param {*} sourceGUID The GUID for a base language source string.
     * @param {[string]} commentsArray An array of comment strings that should be added to the base source string.
     * @returns {boolean} Returns true if successful, otherwise false.
     */
    addComments(sourceGUID, commentsArray) {
        if (sourceGUID == null || commentsArray == null) {
            console.error(`TranslationMemory.addComments() called with null sourceGUID or commentsArray.`)
            return false
        }

        commentsArray.forEach(comment => {
            this.addComment(sourceGUID, comment)
        })
    }

    /**
     * Add a comment to a base language string.
     * @param {*} sourceGUID The GUID for a base language source string.
     * @param {string} comment Adds a single comment to the base source string.
     * @returns {boolean} Returns true if successful, otherwise false.
     */
    addComment(sourceGUID, comment) {
        if (sourceGUID == null || comment == null) {
            console.error(`TranslationMemory.addComment() called with null sourceGUID or comment.`)
            return false
        }

        if (this.sourceForGUID(sourceGUID) == null) {
            console.error(`TranslationMemory.addComment() could not find source for sourceGUID: ${sourceGUID}`)
            return false
        }

        let existingComments = this.commentsForSourceGUID(sourceGUID)
        if (existingComments) {
            if (existingComments.indexOf(comment) >= 0) {
                // The comment already exists
                return true
            }
        }

        let uuid = uuidV4()
        this.db.prepare('INSERT INTO comments(guid,source_guid,comment) VALUES (?,?,?)').run([uuid, sourceGUID, comment])
        return true
    }

    /**
     * Get the translation for a string in a specific language.
     * @param {string} sourceGUID The GUID for a base language source string.
     * @param {*} languageCode A supported language code.
     */
    translation(sourceGUID, languageCode) {
        if (sourceGUID == null || languageCode == null) {
            console.error(`TranslationMemory.translation() called with null sourceGUID or languageCode.`)
            return null
        }

        let translation = this.db.prepare('SELECT translation FROM translations WHERE source_guid = ? AND lang = ?').pluck().run()
        return null
    }

    /**
     * Add a new translation to a base source string.
     * @param {string} sourceGUID The GUID for a base language source string.
     * @param {string} languageCode A supported language code.
     * @param {string} translation A translated string for the given source GUID in the specified language.
     * @returns {string} Returns true if successful, otherwise false.
     */
    addTranslation(sourceGUID, languageCode, translation) {
        if (sourceGUID == null || languageCode == null || translation == null) {
            console.error(`TranslationMemory.addTranslation() called with null sourceGUID, languageCode, or translation.`)
            return false
        }

        let existingTranslation = this.translation(sourceGUID, languageCode)
        if (existingTranslation) {
            if (existingTranslation != translation) {
                return this.updateTranslation(sourceGUID, languageCode, translation)
            } else {
                return true // nothing to update
            }
        }

        this.db.prepare('INSERT INTO translations(source_guid,lang,translation) VALUES (?,?,?)').run([sourceGUID, languageCode, translation])
        return true
    }

    /**
     * Updates a translation for a base source string.
     * @param {string} sourceGUID The GUID for a base language source string.
     * @param {string} languageCode A supported language code.
     * @param {string} newTranslation A new translated string for the given source GUID in the specified language.
     */
    updateTranslation(sourceGUID, languageCode, newTranslation) {
        if (sourceGUID == null || languageCode == null || newTranslation == null) {
            console.error(`TranslationMemory.updateTranslation() called with null sourceGUID, languageCode, or newTranslation.`)
            return false
        }

        this.db.prepare('UPDATE translations SET translation=? WHERE source_guid=? AND lang=?').run([newTranslation, sourceGUID, languageCode])
        return true
    }

    /**
     * Search source strings for a matching term.
     * @param {string} searchTerm A term to search for. If the searchTerm includes SQL wildcard characters (%), those will be respected. Otherwise, wildcard characters will be added before and after the search term.
     * @returns {[*]} An array of objects for matched sources. The objects contain the following properties: id, source
     */
    searchSources(searchTerm) {
        if (searchTerm == null) {
            console.error(`TranslationMemory.searchSources() called with null searchTerm.`)
            return []
        }

        var sql = `SELECT guid AS id,source FROM sources WHERE source LIKE '%${searchTerm}%';`
        if (searchTerm.indexOf('%') >= 0) {
            sql = `SELECT guid AS id,source FROM sources WHERE source LIKE '${searchTerm}';`
        }
        
        let sources = this.db.prepare(sql).all()
        if (!sources) {
            return []
        }

        return sources
    }

    /**
     * Get translations of the specified search term in the base sources.
     * @param {string} sourceSearchTerm A term to search for. If the searchTerm includes SQL wildcard characters (%), those will be respected. Otherwise, wildcard characters will be added before and after the search term.
     * @returns {[*]} An array of objects found. The returned objects have the following structure:
     * [
     *      {
     *          id: "some-id",
     *          source: "some base string",
     *          translations: [
     *              {
     *                  language: "a-language-code",
     *                  translation: "the translation"
     *              }
     *          ]
     *      },
     *      ...
     * ]
     */
    searchTranslations(sourceSearchTerm) {
        if (sourceSearchTerm == null) {
            console.error(`TranslationMemory.searchTranslations() called with null sourceSearchTerm.`)
            return []
        }

        let results = Array()

        let sources = this.searchSources(sourceSearchTerm)
        sources.forEach(source => {
            let translations = this.db.prepare("SELECT lang AS language, translation FROM translations WHERE source_guid = ?").all(source.id)
            if (translations) {
                results.push({
                    id: source.id,
                    source: source.source,
                    translations: translations
                })
            }
        })

        return results;
    }

    /**
     * Get the language codes that exist in the translation memory
     * @returns {[string]} An array of language codes
     */
    existingLanguageCodes() {
        let langs = this.db.prepare('SELECT lang FROM translations GROUP BY lang ORDER BY lang').all()
        if (!langs) {
            return ['en'] // default/base language
        }
        return langs.map(row => {
            return row.lang
        })
    }

    /**
     * Get the list of supported languages.
     * @returns {[*]} An array of language objects with 'language' and 'code' as properties.
     */
    supportedLanguages() {
        return SupportedLanguages
    }
}

module.exports = TranslationMemory
