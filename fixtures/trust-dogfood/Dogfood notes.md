1. What highlighting should be appearing in the workspace? I get highlighting only after the character is added, for example.  
2. Bran is highlighted inside the longer Brannic Halloway full name.  
3. Should there be a way to add a new type in the review phase? For example, I would like to create a `faction` for the `Cinder Compact`  
4. Item review strands the author before reusable effects; ruleset import/basic setup are poorly connected and hidden.  
5. There was a regression where documents don’t maintain their own scroll location.  
6. There was a regression where changing tabs, then going back to the workspace closes the current scene and opens the first, scrolled to where the last scene was.  
7. Find doesn’t work in the workspace scene.  
8. When doing lore extraction with something like `Salt Door` already existing as a location, `the Salt Door` will be flagged as needing a new record.  
9. Source Notes has buttons for import and hiding at the top, and then a start here section below that with write, import, and extract buttons. Why two import buttons? How does the extract at the top differ from the one in the left sidebar or the one appearing when you click edit on the doc? Why is there a new document button in the header of the doc when you open it to edit?  
10. When reviewing fact candidates it surface `Dess` in the Greyharbor lore. It wants to link her to a location, even though there is a character record for her. There is no way to edit the fact that I can see  
      
      
    \- \[UX friction; product-model gap\] A-6/World Bible faction relationships — Creating the Cinder Compact naturally prompted the author to record members and alliances, but custom category fields only provide unlinked text or static selections. They cannot reference World Bible records by stable ID, show reciprocal relationships, follow renames/merges, or represent when an alliance forms or ends. Mechanics currently offers no faction-state alternative, leaving the correct destination unclear. — author dogfood 2026-08-22

\- \[run deviation\] A-6/Cinder Compact — Added a custom Members field while exploring faction modeling. This field is descriptive rather than a structured relationship. Any manually entered fixture facts may affect provenance-sensitive assistant results and should be noted when evaluating D1–D5. — author dogfood 2026-08-22

Structured World Bible relationships

Add author-confirmed, stable-ID relationships between World Bible records for  
common canon connections such as member-of, allied-with, hostile-to, related-to,  
located-in, and controls. Show appropriate reciprocal views without duplicating  
canon. Preserve links through rename, merge, backup, and restore. Extraction may  
propose relationships with evidence, but deterministic validation and explicit  
author acceptance remain required.

Keep manuscript-time faction diplomacy and numerical reputation out of this  
initial slice. First determine whether time-scoped alliance changes belong in an  
extension of the state-event model.

\- \[workflow blocker; trust-path correctness\] A-6/Lore fact targeting — The  
Grayharbor/Undervault extraction proposed “Dess” as an alias of Grayharbor when  
Odessa Vane-Kir was created from an entity proposal in the same extraction  
workflow. Fact extraction could not target the sibling entity proposal and  
fell back to the document’s primary subject. Once a proposal has an automatic  
target, Fact Candidates provides no way to retarget or edit it. Accepting it  
would create incorrect canon. Re-extraction after creating Odessa is the only  
visible workaround. — author dogfood 2026-08-22

\- \[UX friction; trust-path clarity\] A-6/Source Note Placement — After entity  
extraction, the Source Note displayed multiple automatically added canon links  
with unexplained Primary subject, Secondary subject, Mentions, and Supports  
canon choices, plus incomplete “Select target” rows. There is no way to add a new placement row. The UI does not explain  
that these are document-to-record context links rather than accepted facts or  
relationships between entities. “Supports canon” sounds like canon acceptance and it is unclear how it differs from primary,  
and Primary subject silently influences extraction fallback targeting. Placement  
should use author language, distinguish automatic suggestions from saved links,  
enforce or explain primary-subject behavior, and warn that changes must be saved  
before re-extraction. — author dogfood 2026-08-22

\- \[workflow blocker; trust-path correctness\] A-7/B-1/C2 — Extraction produced  
“Compact service: twenty years” as background canon for the Cinder Compact  
instead of Brannic Halloway. The competing “Compact service: a decade”  
candidate therefore has a different or missing target and cannot form the  
expected Canon Review conflict. Workspace AI subsequently refused D2 because  
no accepted Brannic service-length fact existed. — author dogfood 2026-08-23

\- \[trust cleanup defect\] Lore accepted-fact removal — Accepting a background  
fact can materialize it into the target World Bible record’s Notes field.  
Removing the accepted canonical fact does not reverse that materialized field  
update. With a custom category that does not expose Notes, incorrect derived  
content may remain hidden and difficult to repair. — author dogfood 2026-08-23

\- \[UX/fixture ambiguity\] A-7 extraction review — “Source Notes are not canon”  
was reasonably understood to mean their contents should not be accepted, while  
the runbook actually expects selected clean candidates to become canon and  
speculative candidates to remain pending. The UI and runbook do not clearly  
explain this distinction or that conflict detection occurs only after one  
candidate is accepted. — author dogfood 2026-08-23

\- \[UX friction\] AI consultation budget — Lore Inspector and Canon Review share  
a project-level daily consultation limit, but the product does not clearly  
distinguish this budget from ordinary Workspace AI, explain which actions  
consume it, show reset timing, or justify the hard cutoff at the moment of use.  
The cost-control intent is understandable, but the exposed mechanism feels  
arbitrary during normal review work. — author dogfood 2026-08-23

D1 \- fails with inability to verify  
D2 \- succeeds with an inability to verify  
D3 \- succeeds by saying it is not established in canon  
D4 \- potentially fails. The key is listed as being in Odessa’s vault, Even when working on ch 5\.  
D5 \- succeeds perfectly.

\- \[release-blocking trust-path failure\] A-7/D1 — The Sera dossier’s  
“cartographer” occupation was accepted as canon for the Cinder Compact rather  
than Sera Kestrel. Workspace AI consequently refused D1 because no verified  
occupation fact was attached to Sera. This is the third observed target-binding  
failure, following Dess→Grayharbor and Brannic service→Cinder Compact, indicating  
a systemic extraction/Placement problem rather than an isolated candidate.  
Expected accepted fact: “Sera Kestrel occupation: cartographer.” Actual:  
“The Cinder Compact occupation: cartographer.” — author dogfood 2026-08-23

Resume checkpoint  
Date/time: 2026-08-23  
Completed through: Lore intake and partial Canon/Assistant review; Session D stopped early  
Active project(s): \[project name\]  
Last backup: \[backup filename\]  
Blockers:  
\- Repeated extracted facts attached to the wrong canon target  
\- Automatically targeted facts cannot be corrected before acceptance  
\- Expected proposal/proposal conflicts do not form  
\- Removing accepted facts may not reverse materialized side effects  
\- Assistant checks cannot succeed because required canon is mis-targeted  
\- Session E prerequisites and author journey are not understandable from the runbook or UI  
Next exact step: Triage findings and define bounded fixes before resuming dogfood  
Evidence pointers: \[screenshots/notes\]

\- \[workflow blocker; fixture/onboarding failure\] Session E — After completing  
the already difficult ruleset, character, lore, and canon prerequisites, the  
author could not determine where or how to enter the scripted state events or  
understand the relationship between sheets, scene mutations, item use, and  
replay. The runbook names internal commands instead of providing an  
author-facing journey, while the application exposes multiple overlapping  
entry points. E1–E5 were not run. — author dogfood 2026-08-23


## Run of 2026-11-22

- [UX friction; mental model] Corkboard/Draft scenes — "Link current scene" on a chapter card appeared to attach the whole chapter. Working as designed: it links the open document, and the fast-path loader imports each chapter as one scene, so the "scene" is the whole chapter. Nothing in the Workspace corkboard dialog says that a card is the plan and scenes are separate documents (the explanatory line shows only on the full Corkboard route). Fix folded into roadmap 4.85. — author dogfood 2026-11-22
- [product gap] Corkboard/AI planning — No way to talk to the model about the chapter arc or get help planning scenes and beats (beats = a card's plot points; scenes = draft documents). Writing coach sees only dashboard measurements, Draft this scene reads one card's summary and plot points, and the Workspace assistant never reads chapter cards. Drafted as roadmap 4.85 (read-only planning chat) and 4.86 (chat proposes outline changes for review). — author dogfood 2026-11-22
- [UX friction; purpose unclear] Character packages — Unclear whether packages are meant for a book series. They copy characters (canon, aliases, facts, optional sheets) into another project; a series sharing one world is meant to use Parent project on Projects, which shares canon read-only. The page does not say this. Drafted in roadmap 4.87 (copy fix). — author dogfood 2026-11-22
- [missing capability] Character packages — Export is all characters or one at a time from World Bible; no way to pick a subset. The export service already accepts a list of entity ids; the route has no picker. Drafted as roadmap 4.87. — author dogfood 2026-11-22
- [UX friction] Settings/Feature Toggles — In General Fiction mode the four feature toggles seem unnecessary. Checking the code: two of them (Runtime Modifiers, Settlement/Zone Systems) are not read anywhere and do nothing. Drafted as roadmap 4.88. — author dogfood 2026-11-22
- [UI polish] Spacing — Settings → Reading & Editor: the "Source Notes open in" buttons touch the box below (section bodies have no gap between controls). Labels to the left of inputs are tight, e.g. Settings → Highlight visibility (select on the same line as its label with no gap; screenshot 2026-11-22). Drafted as roadmap 4.89. — author dogfood 2026-11-22
- [feature request] Editor appearance — Author wants more switchable options: paragraph style (indent vs spaced), a narrower text width (Focused/Wide exist), more fonts or a system font, focus mode, and typewriter scrolling. Drafted as roadmap 4.90–4.92. — author dogfood 2026-11-22
- [data-loss risk] Storage/backups — Asked how projects are stored without export: continuously in IndexedDB inside the app's data folder, with no copy elsewhere and no reminder to export. A lost or wiped folder (or cleared browser data) loses everything. Drafted as pre-beta roadmap 4.93 (backup reminder) and 4.94 (scheduled automatic backups to a chosen folder, desktop). — author dogfood 2026-11-22
- [workflow gap] Rewrites and versions — No non-destructive way to rewrite a paragraph while seeing the original, no document versioning, and no clear way to keep Draft 1 vs Draft 2 (export feels final). Drafted as roadmap 4.95 (scene snapshots), 4.96 (draft milestones), 4.97 (rewrite beside the original). — author dogfood 2026-11-22


## Run of 2026-11-28

- [UI copy bug] Settings/Highlight visibility — The hint below the select always describes Hidden while typing, whatever mode is chosen. It has been static text since it was added (e4a8fd9), not a regression, but it reads as if it should follow the choice. Drafted as roadmap 4.98. — author dogfood 2026-11-28
- [UX friction; copy unclear] Settings/Paragraphs — "changes the manuscript and Source Notes editors only, not exports" was confusing. The setting is a per-device display preference; exports have their own fixed layout (EPUB: a gap between paragraphs, no indent; DOCX: Word's default paragraph). Copy fix drafted in 4.98; an export paragraph-style choice is an open question for the author. — author dogfood 2026-11-28
- [feature request] Character sheets/Images — Wants to upload one or more images per character. No record images exist; map images (4.80) are the only stored images. Matches the parked "Images" backlog item (2026-10-06); drafted as roadmap 4.100, pending a scope decision. — author dogfood 2026-11-28
- [workflow gap] World Bible/Multiple imports — Heading choices are made per draft, so sending "Appearance" to a field on one draft does not apply to the same heading on the others; they only pick up the field after the first draft is imported (one at a time). "Use detected headings" only turns on structured headings for each selected draft. The only per-card action is Import and open, which opens the full record editor; the next draft then means scrolling back up past the imported cards. Drafted as roadmap 4.99. — author dogfood 2026-11-28
