export const flagThemes = {
  rye: { name: "RYE colors", colors: ["#8f68bc", "#9188c9", "#c9c4ce"] },
  lesbian: {
    name: "Lesbian Pride",
    colors: [
      "#d52d00",
      "#ef7627",
      "#ff9a56",
      "#ffffff",
      "#d162a4",
      "#b55690",
      "#a30262",
    ],
  },
  rainbow: {
    name: "Rainbow Pride",
    colors: ["#e84c56", "#ff9b48", "#ffdb61", "#62ad75", "#6088d3", "#9566be"],
  },
  trans: {
    name: "Transgender Pride",
    colors: ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"],
  },
  nonbinary: {
    name: "Nonbinary Pride",
    colors: ["#fcf434", "#ffffff", "#9c59d1", "#2c2731"],
  },
  bi: { name: "Bisexual Pride", colors: ["#d60270", "#9b4f96", "#0038a8"] },
  pan: { name: "Pansexual Pride", colors: ["#ff218c", "#ffd800", "#21b1ff"] },
  ace: {
    name: "Asexual Pride",
    colors: ["#25202c", "#a3a3a3", "#ffffff", "#800080"],
  },
} as const;

export type Flag = keyof typeof flagThemes;
export const topics = ["Belonging", "Identity", "Speaking up", "Joy"] as const;
export type Topic = (typeof topics)[number];

export type StoryPhoto = {
  src: string;
  description: string;
  portraitSrc?: string;
};

export const maxStoryPhotos = 3;
export const maxPhotoBytes = 768 * 1024;
export const maxPortraitBytes = 256 * 1024;
export const maxPhotoDescription = 180;
export const jpegDataPrefix = "data:image/jpeg;base64,";

export type Voice = {
  id: string;
  name: string;
  place: string;
  title: string;
  quote: string;
  body: string;
  flag: Flag;
  topic: Topic;
  sample: boolean;
  mine?: boolean;
  portrait?: number;
  photos?: StoryPhoto[];
  usePhotoAsPortrait?: boolean;
  center?: [number, number];
};

export const samples: Voice[] = [
  {
    id: "mara",
    name: "Mara",
    place: "Philippines",
    title: "Room for one more",
    quote:
      "My lola pulled up a chair for the person I loved. That was her whole speech.",
    flag: "lesbian",
    topic: "Belonging",
    portrait: 0,
    center: [121, 14],
    sample: true,
    body: `I practiced an introduction on the jeepney all the way to my lola’s house. By the time we reached her gate, every version sounded like I was introducing a guest speaker at school. Jo squeezed my hand and asked if she should carry the pancit. I was so grateful for a question I could answer.

My lola was at the table peeling a mango with a small knife. “This is Jo,” I managed. “My girlfriend.” Lola looked up, looked at the five places already set, and sent my cousin to get the folding chair from the back room.

Lunch went the way it always does. Someone complained about the heat. My uncle lost an argument about how much calamansi goes in the noodles. Lola put the best pieces of mango on Jo’s plate. All that ordinary noise felt like a gift.

When we left, Lola called after us to bring the containers back next Sunday. Us. I had spent weeks preparing the words to get through the door. The word I took home was the one that invited us back.`,
  },
  {
    id: "caio",
    name: "Caio",
    place: "Brazil",
    title: "The name on the poster",
    quote: "For the first time, the name on the poster was mine.",
    flag: "nonbinary",
    topic: "Identity",
    portrait: 1,
    center: [-46, -23],
    sample: true,
    body: `Our band printed its first gig posters at a copy shop two streets from my flat. I was supposed to check the date, the door time, and whether the little drawing of a drum looked enough like a drum. I opened the proof and stopped at the name under the bass guitar.

A month earlier, I had asked my friends to call me Caio. We had talked about it once, in the practice room, between two songs. I had never told them how long I had tried that name out quietly before I said it aloud.

There it was in the same crooked type as everyone else’s. Nobody had drawn a circle around it. Nobody needed me to explain. I texted the group that everything looked good and asked for three extra copies.

I gave one to my sister, taped one above my amp, and kept the last folded in my pocket through the whole show. We missed the first cue. We played our encore too fast. It is still my favorite poster.`,
  },
  {
    id: "noor",
    name: "Noor",
    place: "India",
    title: "A different kind of roll call",
    quote:
      "One small change to the register made it easier to walk into class.",
    flag: "trans",
    topic: "Speaking up",
    portrait: 2,
    center: [77, 19],
    sample: true,
    body: `On the first morning of term, our art teacher put a blank card on every desk. She asked us to write the name we wanted her to use. She collected the cards while we unpacked pencils, water jars, and that one impossible tube of dried-up paint.

I had been waiting for the usual pause at roll call. This time she read my name, I said “here,” and she moved on. For the rest of that hour I got to worry about drawing hands, just like everybody else.

Later I asked if the other classes could do it too. A friend came with me to the department office because I knew I would talk too quickly on my own. We explained what had worked and offered to cut the cards for the next term.

I still have paint on the cuffs of that shirt. When I see it, I remember how little space my name took on a piece of paper, and how much room that gave me in the classroom.`,
  },
  {
    id: "rowan",
    name: "Rowan",
    place: "Ireland",
    title: "The long way home",
    quote: "We took the long way home because the conversation was so good.",
    flag: "bi",
    topic: "Joy",
    portrait: 3,
    center: [-8, 53],
    sample: true,
    body: `I turned up for the walking group with a raincoat and a list of reasons to leave early. Meeting people again in my fifties felt a little like starting school with the wrong copybook.

Five of us gathered under the awning. Within ten minutes we had covered bus timetables, bad knees, and which bakery made the best brown bread. By the river, someone mentioned an old girlfriend. I mentioned one of mine. The conversation carried on so easily that I nearly laughed.

At the fork in the path I was the one who suggested the longer route. We got a bit wet, bought a bag of pastries, and made plans for the following Sunday. These days I carry a spare raincoat in case someone new turns up without one.`,
  },
  {
    id: "min",
    name: "Min",
    place: "South Korea",
    title: "A shelf of our own",
    quote:
      "I found a book with a life like mine, then made room for the next reader.",
    flag: "ace",
    topic: "Identity",
    portrait: 4,
    center: [128, 36],
    sample: true,
    body: `The book was tucked between two much larger novels in a café exchange box. On page thirty, a character described friendship in a way I had been trying to put into words for years. I missed my bus because I kept reading.

I asked the café owner if I could make a little recommendation card. I wrote that this book had helped me understand being ace, and that the jokes on page forty were terrible in the best possible way. I signed with my initial.

A week later there was another card next to mine. Then a second book. We have half a shelf now. Some recommendations are signed and some are just a line of careful handwriting. Every time I stop for coffee, I check what someone has left for the next person.`,
  },
  {
    id: "amani",
    name: "Amani",
    place: "Kenya",
    title: "A song for the kitchen",
    quote:
      "By the last chorus, even the quietest person in the kitchen was singing.",
    flag: "rainbow",
    topic: "Joy",
    portrait: 5,
    center: [37, 0],
    sample: true,
    body: `When I moved, my friends offered to carry boxes in exchange for supper. We had two pots, one working hotplate, and a borrowed speaker. Someone made a playlist called “Kitchen Committee” and gave us all permission to add a song.

By sunset the plates were still packed, so we ate out of mugs. We played songs from our first crushes, songs from long bus rides, and one gloriously out-of-tune recording from a school concert. Everybody got to tell the story behind their choice.

I had worried that a new place would take months to feel like home. Now I can stand in that small kitchen, press play, and hear the room fill up again. Our playlist keeps getting longer.`,
  },
  {
    id: "ines",
    name: "Inés",
    place: "Spain",
    title: "The spare screw",
    quote: "I said “my wife” over a pile of tiny screws, and the man next to me asked if she could fix his lamp too.",
    flag: "lesbian",
    topic: "Belonging",
    portrait: 6,
    center: [-3.7, 40.4],
    sample: true,
    body: `My wife Ana sent me to the Saturday repair café with a desk lamp and one instruction: take a photo before you undo anything. Five minutes later I had six screws on the table and no idea where the sixth had come from.

The man next to me held out a saucer for the screws. I told him my wife would have remembered which one went where. He asked if she could have a look at his lamp too. We both leaned back over the table. I’d spent years deciding when it felt safe to say those two words. Sometimes I still hear myself say them before I hear the rest of the sentence.

I brought Ana the next Saturday. He’d brought a second saucer. By noon she had his lamp working, and I had finally found the hole for that spare screw.`,
  },
  {
    id: "tavita",
    name: "Tavita",
    place: "New Zealand",
    title: "The second key",
    quote: "The next Saturday I got there early enough to open the gate for somebody else.",
    flag: "nonbinary",
    topic: "Belonging",
    portrait: 7,
    center: [174.8, -36.9],
    sample: true,
    body: `When I joined the community garden, I spent a month waiting outside the gate until someone let me in. I always got there first. It took me that long to ask whether the key in the shed was for everyone.

At the next workday I put they and them beside my name on the volunteer board. Later I heard someone get it wrong. Mei corrected them while she was tying a tomato plant to a stake. By the time I carried the watering can over, they were discussing slugs.

A week later Mei gave me the second gate key. She said she hated getting up early and had noticed that I liked it. The next Saturday I got there in time to open the gate for a woman carrying a tray of seedlings. She asked if it was all right to come in. I said yes and showed her where we kept the spare gloves.`,
  },
  {
    id: "leila",
    name: "Leila",
    place: "Canada",
    title: "One more stop",
    quote: "She offered to ride one more stop with me. I asked if we could make it two.",
    flag: "bi",
    topic: "Speaking up",
    portrait: 8,
    center: [-123.1, 49.3],
    sample: true,
    body: `Our book club met down the street from the last bus stop. In January we picked a novel about a woman who kept changing her plans to suit everyone around her. I’d written three notes in the margins and crossed out all three.

When it was my turn, I said I was bi and that I recognized the feeling of letting other people tell me what my own life meant. Jules asked which page I’d marked. It was page eighty-two. She turned to it and read a sentence I’d missed. We spent the next ten minutes arguing about whether the character should sell her car.

On the way home, Jules offered to ride one more stop with me. I asked if we could make it two. I remember the windows steaming up while we tried to pick a book for February.`,
  },
];

export function excerpt(body: string) {
  const first = body.trim().split(/\n+/)[0];
  if (first.length <= 145) return first;
  return first.slice(0, 142).replace(/\s+\S*$/, "") + "…";
}
export function readTime(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));
}
