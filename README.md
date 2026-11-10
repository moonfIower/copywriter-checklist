# Copywriter Checklist

Review article and webpage drafts in a local Obsidian sidebar. Check metadata, heading structure, readability, keyword coverage, links and images as you write.

## Get started

1. In a Markdown note's Properties, set `content_type` to `article` or `webpage`.
2. Click the pencil ribbon icon or run **Copywriter Checklist: Open sidebar**.
3. Add the fields you need. **Settings → Copywriter Checklist → Copy note properties** copies a starter block. Paste it at the top of a note in Source mode. If the note already has Properties, add only the missing lines inside the existing block.
4. Use **Pin sidebar** to reopen the checklist when you return to this draft.

| Property | Purpose |
| --- | --- |
| `content_type` | `article` or `webpage` |
| `title_tag`, `meta_description` | Search result metadata |
| `url` | Full page URL; used for slug and same-site link checks |
| `primary_keyword`, `secondary_keywords`, `local_keywords`, `topical_keywords` | List of phrases, one phrase per item |
| `category`, `category_tags` | Optional category and tag metadata |
| `word_goal` | Optional numeric word goal for this draft |
| `word_count` | Body word count, filled when automatic updates are enabled |

Click a keyword or finding to jump to its source. Keyword counts include published metadata and common wording variations. The score summarizes the checklist benchmarks, which you can change in settings.

## Note changes and privacy

Analysis runs locally. The plugin sends no note content or telemetry and does not fetch remote images. By default it does not update word properties. To use live counts in Bases, enable **Update word count properties** in settings. This writes `word_count` and `word_goal` on eligible drafts and migrates an older `word_count_goal` property when present. Placing or moving a bookmark adds or moves a marker in that note.

## Compatibility and development

This release targets desktop Obsidian 1.10.6 and later. Bookmark dragging uses a mouse. No other plugin is required.

Run `npm run build` to generate `main.js` and `npm test` to run the test suite (Node.js 18 or later). To run the optional companion integration tests, set `COPYWRITER_COMPANION_BUNDLE` to a built Manuscript Checklist `main.js`.

Report bugs through the repository's Issues tab. Include your Obsidian version, operating system, and steps to reproduce. Use a fictional or redacted example if a note is involved.

MIT licensed.
