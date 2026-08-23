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

