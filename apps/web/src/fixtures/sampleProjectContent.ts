/**
 * Bundled first-run sample project content, trimmed from the two-chapter
 * opening and two lore documents of `fixtures/trust-dogfood/` (the
 * repo's Slice 1.1 trust-dogfood fixture) per Slice 5.4. Trimmed to the
 * self-contained "Brannic's years of service" contradiction between the
 * two lore documents (fixture plant C2) — later chapters and other planted
 * issues from the full fixture are not included, and the working notes
 * document is trimmed to only the one relevant brainstorm line so the
 * sample does not carry unrelated spoiler material (including the fixture's
 * explicit "DO NOT seed this until decided" plant, which has no place in a
 * shipped sample regardless of context).
 *
 * This is prose content only — no ruleset, no accepted canon, no
 * pre-computed review findings. The getting-started guide walks the author
 * through creating those themselves, using the real extraction and
 * canon-decision pipeline rather than a fixture standing in for it.
 */

export interface SampleChapter {
  title: string;
  content: string;
}

export interface SampleLoreDocument {
  title: string;
  kind: 'character_dossier' | 'faction_notes';
  content: string;
}

export const SAMPLE_PROJECT_NAME = 'The Emberglass Key (Sample)';

export const SAMPLE_CHAPTERS: SampleChapter[] = [
  {
    title: 'Chapter One — The Salt Door',
    content: `The tide went out at four bells, and Sera Kestrel went down with it.

The stair cut into the cliff face below Grayharbor had no rail, no lamps, and no forgiveness. Black basalt, slick with weed, each step worn to a shallow bowl by centuries of delvers who had made this same descent and mostly come back. Sera kept her left shoulder against the rock and her eyes on her boots. Forty feet below, the sea pulled back from the cliff like a curtain drawn on a stage, and the Salt Door stood exposed in the wet dark — a slab of pale stone twice her height, crusted to the waist in barnacle and brine, carved with a single line of script no one living could read.

"Don't rush the last ten steps," Brannic Halloway called down from above her, his cane ringing on the stone. "Some of them are more idea than stair."

"You say that every time, Bran."

"And every time you're still alive at the bottom. I take my victories where they're kept."

She reached the shelf at the base of the cliff with her lungs burning and her legs full of sand. The climb down was nothing — it was the three hours of hauling gear from the upper terraces before it that had emptied her. She unstoppered the little clay bottle Tam had pressed on her that morning and drank the Pale Draught in two swallows. It tasted the way a whitewashed wall smells. Warmth crawled out from her sternum into her arms, and the trembling in her thighs faded. Her brother was an apprentice lamplighter, not an alchemist, but he knew which stall in the fish market sold the honest tonics.

[Stamina restored.]

The line hung in the corner of her vision, pale letters on nothing, the way the Ledger always wrote itself. Two years since the marks had crawled up her wrist and she still flinched at it. Look at any delver's eyes when a line appears and you could see the same flinch, hidden fast.

Brannic reached the shelf and stood beside her, breathing hard through his nose. He was past fifty, gray to the collar, and he had come down a rope-and-plank lift the Compact had rigged for him in the years since the Vault took his knee. He leaned on the cane and studied the Door the way other men studied an opponent.

"Tide gives us two hours," he said. "The Compact wants the antechamber mapped and nothing more. You mark me, Sera. Mapped. Not opened, not tested, not pried at."

"I was a cartographer before I was anything else." She was already unrolling the oilcloth wrap of pens and the salt-treated paper. "Mapping is the one thing you never have to ask me twice."

"It's the other things I ask twice." But he smiled when he said it.

The Salt Door had been open for eleven days, ever since the quake in the spring tides had cracked its seal and half of Grayharbor had felt something exhale beneath the harbor. The Cinder Compact had claimed delving rights within the week, posted wardens on the cliff stair, and started sending small teams down at every low tide. Sera's team was the smallest: one senior warden with a ruined knee, and one junior delver with steady pen-work and a Ledger-mark she had never asked for.

Inside, the antechamber swallowed their lantern light. It was larger than the Compact hall, larger than the Grand Weighing House, walls of the same pale stone as the Door rising into dark the light refused to climb. The floor was dry. That was the first wrong thing. The sea had stood against that Door for longer than Grayharbor had existed, and the floor was dry as a hearthstone.

Sera worked in long quiet passes, pacing distances, sketching the twelve pillars, the shallow channel cut in the floor that ran from the entrance to the far wall, the raised dais at the channel's end. Brannic kept the Wardlight Lantern high. Its aether-oil flame burned a steady blue-white, and where the light fell, the thin gray haze that hung in the chamber's corners drew back like something alive and patient.

"Vaultburn miasma," Brannic said, when he caught her watching it. "It creeps where wardlight doesn't reach. It got into my knee the old way, before we had the lanterns. Stay in the light and it stays polite."

The far wall held the second wrong thing. A gate of dark metal, small as a cottage door, ordinary as anything — except for the lock. The lock was a socket of orange glass, glowing faintly, warm even from ten feet away, shaped to take something Sera had never seen.

She had her pen above the paper to sketch it when the ward on the dais discharged.

There was no warning the Ledger deigned to give her. White light took the chamber, a sound like the world's largest bell struck once underwater, and a hand of pure force slapped her off her feet and across the stone. She landed on her back with her ears ringing and the taste of copper filling her mouth.

[Health: 62/100.]

"Sera!" Brannic was over her, lantern swinging, his face gray as the miasma. "Talk to me, girl."

"I'm—" She coughed. Her ribs lit up like a struck match. "I'm counting my teeth. All accounted for."

"That was a warding circle. Dormant eleven days and it chooses now." He hauled her up by the forearm with more strength than a man with a cane had any business keeping. "We're done. Tide or no tide, we're done for today."

It was when she bent to gather her scattered pens that she saw it, lying in the channel where the discharge had thrown it — or unveiled it. A shard of orange glass the size of her palm, cut with facets that caught the wardlight and turned it the color of a banked fire. Warm when she picked it up. Warm like a living thing.

The shape of it matched the socket in the dark gate exactly.

"Bran." She held it up. "Tell me I'm wrong about what this is."

Brannic Halloway looked at the Emberglass Key for a long moment, and for the first time in the two years she had run the cliffs with him, Sera watched her warden hesitate.

"Wrap it," he said finally. "Wrap it, pocket it, and neither of us speaks a word of it above the tide line until I've thought. Grayharbor has ears, and some of them are already listening for exactly this."

They climbed back up with the sea already returning below them, hungry against the shelf. Sera's ribs ached with every step, the Draught long since spent, the shard a coal of warmth against her hip. Above, the lamps of the city were coming on one terrace at a time — Tam's work, some of them, small and steady and honest.

Some things you carry up out of the dark, she thought, and the dark comes up with them.

She was right sooner than she wanted to be.`
  },
  {
    title: 'Chapter Two — The Ledgerbound',
    content: `Three days of thinking was all Brannic allowed himself, and on the fourth low tide they went back down with the Emberglass Key.

"The Compact will have my knee and yours both if this goes wrong," he said on the shelf, while the sea drew back from the Salt Door. "So it doesn't go wrong. We open the gate, we look, we close it, and we report every stone of it to the Warden-Council before the tide turns. Agreed?"

"Agreed." Sera's ribs still clicked when she breathed too deep, but the Ledger had crawled her health back up over the three days, the way it always did, grudging as a moneylender.

The socket took the Key like it had been thirsty for it. Orange light ran out from the lock through hairline channels in the dark metal, and the little gate swung inward on silence — no grind, no protest, eleven centuries of stillness and it moved like a well-kept clock.

Beyond it, stairs went down.

The passage below the antechamber was narrow enough that Brannic's lantern lit both walls at once, and cold in a way the sea never managed. The gray haze was thicker here. It moved at the edge of the wardlight with the patience of something that had waited a very long time and could wait a little more.

The stair ended in a gallery, and the gallery was not empty.

Sera had heard the stories every delver hears — the husks, the Vault's keepers, the dead-that-tally. Hearing is one thing. Watching a shape unfold from the base of a pillar, gray as the miasma, wearing the corroded remains of an armor no smith in Grayharbor could name, and turning toward the light a face with nothing left of a face — that was another kind of education entirely.

"Husk!" Brannic barked, and the lantern came up, and the fight was on.

It came at her slower than a man but wrong, all of its speed arriving at once at the end, like the last inch of a closing door. She got the first cut wrong, felt her knife skate off the corroded plate, and paid for it — the husk's backhand caught her shoulder and spun her into the pillar hard enough to gray her vision at the edges.

Reach for it, something in her said, and for once she listened. The Vault's aether was everywhere down here, thick as harbor fog, and her marks drank it. She put her palm against the husk's breastplate as it closed and pushed — not with her arm, with the mark, with everything the Ledger had written into her wrist two years ago.

The discharge cracked like river ice breaking. The husk went backward off its feet, armor plates scattering, and did not get up so much as come apart, gray dust sighing out of its seams until there was nothing on the gallery floor but metal and stillness.

[Aether: 18/50.]

Twelve points of aether in one strike. No wonder the old delvers called it burning coin.

"Well." Brannic lowered the lantern, breathing hard. "Now we know the stories keep honest books."

They found the tally room past the gallery — walls of small stone drawers, floor-to-ceiling, most burst open long ago, and in the center a lectern of the pale stone with a groove where some ledger of the old world must once have rested. Sera mapped it with her heart still hammering. It was while she was pacing the far wall that the gray haze found the gap the fight had opened.

She never felt it touch her. That was the vicious part. She only saw, when they were back on the stair and climbing for the tide, the line the Ledger wrote across her vision, prim as a clerk:

[Status: Vaultburn.]

And beneath it, in smaller letters, a second line she had never seen before:

[Level 4 — Delver. The Ledger acknowledges its own.]

Brannic said nothing when she told him, but his mouth went thin, and he kept the lantern close against her side the whole way up, as if wardlight could still argue with what was already under her skin.

---

The terraces were full of evening when they came up over the cliff lip — lamps lit, gulls quarreling over the fish-market leavings, the ordinary blessed noise of a city that did not know what slept below its harbor. Brannic went to make his report to the Warden-Council. Sera went to find her brother, and instead found a stranger waiting at the head of the cliff stair.

He stood where the stair's warden should have stood, and there was no warden anywhere Sera could see. A lean man in a coat cut too fine for the docks, salt-white hair though his face was young, gloved hands resting one over the other on the head of a walking stick he clearly did not need.

"Sera Kestrel," he said, pleasantly, as though they were resuming a conversation. "The Ledgerbound herself. Grayharbor is very proud."

"You have a name?" she said. "Or do I guess?"

"Corvo Lash." He smiled the way a ledger smiles — thin, exact, all accounting. "A broker of sorts. I represent parties with a standing interest in what the spring quake uncovered. Parties who pay honestly for honest maps. Better than wardens' wages."

"The Compact holds the delving rights."

"The Compact holds a paper," said Corvo Lash, "and papers burn. Keep well, Ledgerbound. We will speak again when you've had time to be sensible."

He inclined his head — courteous as a knife going back in its sheath — and walked into the lamplight, and was gone between one terrace and the next.

Sera stood at the stairhead until her heart slowed, one hand pressed flat over the pocket where the Emberglass Key rode warm against her hip. Then she went down into the fish market and found Tam closing the lamp on the corner of Netmaker's Row, and let him talk about his day, his supervisor, the price of wick-cord — anything at all that was small and ordinary and above the tide line.

"You look like Ma tonight," Tam said, out of nowhere, halfway home. "It's the eyes. Her same green, and the same trick of going somewhere else with them."

"Flatterer." She knocked her shoulder against his. "Ma could also fillet a man at forty paces with those eyes."

"Well," her brother said reasonably, "so can you. That's my whole point."

She laughed, and it helped, and it didn't. Somewhere below the lamps the gray haze waited in her blood, patient as its parent in the dark, and somewhere above them in the fine streets a man with salt-white hair was writing her name in someone else's ledger.`
  }
];

export const SAMPLE_LORE_DOCUMENTS: SampleLoreDocument[] = [
  {
    title: 'Character Dossier — Sera Kestrel',
    kind: 'character_dossier',
    content: `Sera Kestrel is twenty-six years old, Grayharbor-born, raised on the fourth terrace above Netmaker's Row. She trained as a cartographer under the Surveyors' Guild and spent four years drawing coastal charts before the Ledger-marks appeared on her wrist at twenty-four, ending her guild apprenticeship and beginning her delving career. She is now a junior delver of the Cinder Compact, assigned to Warden Brannic Halloway.

Her friends and her brother call her Ash — a childhood nickname from the year the Kestrel house chimney burned, when she walked out of the smoke carrying the cat and the family charts and nothing else. After the Salt Door survey she acquires the epithet "the Ledgerbound," which she dislikes and cannot shake.

Appearance: tall, wiry, dockworker's shoulders from two years on the cliff stairs. Brown hair kept short and practical. Her eyes are gray, like her father's. Ledger-marks cover her left wrist and forearm — fine interlocking lines resembling tally-script, ordinarily ink-dark, shining pewter when she draws aether.

Family: her mother, Maren Kestrel, was a harbor pilot, lost with the pilot boat Gannet when Sera was nineteen. Her father, Josef, a chart-binder, died two winters later. Her only living family is her younger brother Tam, nineteen, an apprentice lamplighter, whom she has half-raised and remains fiercely protective of.

Abilities: Sera is Ledger-Marked, one of perhaps thirty in Grayharbor. She sees the Ledger's stat-lines, and she can discharge stored aether through her marks in close contact — a costly strike capable of destroying a Vault husk outright. Her aether pool is modest and slow to recover; overuse of the discharge leaves her drained for days. She is a superb draughtswoman and a competent knife-fighter, trained by Compact wardens.

Temperament: methodical on paper, reckless in a corridor. She keeps her word with a bookkeeper's exactness, distrusts institutions but trusts individual people too quickly, and copes with fear by counting and cataloguing.`
  },
  {
    title: 'Faction Notes — The Cinder Compact',
    kind: 'faction_notes',
    content: `The Cinder Compact is Grayharbor's chartered delving company: part guild, part militia, part salvage house. It holds the city's exclusive delving rights by charter from the Terrace Council, maintains the warden posts on the cliff stairs, and takes a fifth-share of all Vault salvage weighed through the Grand Weighing House.

Founding: the Compact was founded sixty years ago, in the ash-winter after the Narrows Vault fire, when the surviving delve-crews of the harbor pooled their charters rather than burn separately. The oldest surviving documents carry the original name, the Compact of Cinders, which appears on the founding charter and the first three ledgers before the shorter form took hold. Old dockhands still say "the Compact of Cinders" when they want to sound like their grandfathers.

Structure: the Compact is governed by the Warden-Council — seven senior wardens elected by charter-holding members. Below the Council sit the wardens (field commanders and stair-keepers), then chartered delvers, then junior delvers and apprentices. Compact wardens carry black iron badges; the stair posts are considered the most honorable and most tedious duty.

Notable members:

Brannic Halloway, Warden. Brannic has served the Compact for twenty years, the last eight of them on light duty after a Vaultburn infection destroyed his right knee in the Narrows collapse. He is the Compact's most experienced living Vault-hand, its best judge of junior delvers, and by common consent the only warden the Council trusts to supervise the Salt Door surveys. He walks with a cane and mentors Sera Kestrel.`
  },
  {
    title: 'Working Notes — Book Two Brainstorm (EXPLORATORY — NOT CANON)',
    kind: 'faction_notes',
    content: `Loose planning notes. Nothing here is decided; treat nothing in this document as canon.

Brannic timeline problem: in my first outline Brannic had served the Compact a decade, not twenty years, because he needed to be young enough to have known Maren Kestrel as a pilot. Check which version Book One actually implies before Book Two locks anything.`
  }
];
