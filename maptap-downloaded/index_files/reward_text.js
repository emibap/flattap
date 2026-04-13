// Track recently used texts to avoid repeats
if (!window.recentRewardTexts) {
    window.recentRewardTexts = [];
}

function rewardText(distance) {
    const perfectText = [
        "100%! Geography genius confirmed.",
        "Perfection!",
        "Textbook perfect!",
        "Exactly right! No notes.",
        "Bullseye!",
        "Can't improve on that.",
        "You've done this before, haven't you?",
        "Save some points for the rest of us.",
        "You didn't just find it, you moved in.",
        "Ok, show-off. We get it.",
        "Score: yes.",
        "You single?",
        "I'm going to tell my kids about this tap.",
        "Do that again.",
        "marry me",
        "legend"
    ];

    const greatText = [
        "You might as well move in.",
        "Unbelievably good. Wow!",
        "Better than a GPS!",
        "So close you could join their wifi!",
        "Pinpoint accuracy!",
        "Practically neighbors!",
        "Geographical genius!",
        "Master geographer!",
        "Superb!",
        "Great!",
		"Next stop: writing your own atlas.",
        "Fantastic!",
        "Nailed it!",
        "You can see them waving to you!",
        "You are a local!",
        "Just a stone's throw away!",
        "Impressive!",
        "Do you live here?",
        "You're almost spot on!",
        "Close enough for a selfie!",
        "You can see it from here!",
		"You have a future in cartography!",
		"Google Maps is going out of business!",
		"Smarty pants!",
        "Are you from here or just stalking?",
        "Ok now you're just showing off.",
        "Did you zoom in? You zoomed in.",
        "Welcome to the neighborhood!",
        "You're basically roommates now.",
        "They heard you click.",
        "Is this your day job?",
        "That was a flex and we both know it.",
        "Are you a descendant of Magellan?"
    ];

    const goodText = [
        "You could walk there ... in 100 hours",
        "Oh, so close!",
        "You are on the right track!",
        "Soooooo close!",
        "I'd still let you navigate",
        "Just over the horizon",
        "A valiant effort!",
        "Where you clicked is nice too!",
        "Almost there!",
        "Not quite!",
		"Solid score!",
        "Just around the corner!",
        "Not bad",
		"Wrong side of the mountain",
        "Just a (month-long) hike away",
        "Hope you don't have to walk from here.",
		"Right energy, wrong location",
        "So close, yet so far!",
		"It would be an expensive Uber from here.",
        "A very generous definition of 'near'.",
        "Right vibe, wrong address.",
        "Not wrong, just... alternative.",
        "The vibe was right, the coordinates were not.",
        "Has your GPS ever said 'recalculating'?",
        "Right freeway, wrong exit.",
        "Your heart was in the right place. Your finger wasn't."
    ];

    const soSoText = [
        "Could have been worse?",
        "Do you hear 'Your other left' a lot?",
        "Maybe they would move for you?",
        "In the neighborhood?",
		"Yup, somewhere on Earth!",
        "In cosmic terms, bullseye!",
        "Not awful?",
        "Close...ish. Like same-continent close",
        "It's ok, maps are hard.",
        "Correct side of the planet!",
        "It'd be so much easier if this had labels.",
        "Are you better at wordle?",
        "It's ok, I still think you're smart",
        "Whups",
        "Who knew geography was so hard?",
		"That's a place! The wrong place.",
        "That's... creative geography.",
        "That's adorably wrong.",
        "You'd need a really good telescope.",
        "Geography is overrated.",
        "Right hemisphere! That counts for something.",
        "Right planet! Small victories.",
        "You tried! Gold star for trying.",
        "Confidently incorrect.",
        "Were you distracted by something shiny?",
        "You and the answer are in a long-distance relationship.",
        "You didn't miss, you explored.",
        "¯\\_(ツ)_/¯"
    ];

    const badText = [
        "Maybe next time ask for directions?",
        "Your geography teacher just started sobbing",
        "A for effort, F for geography.",
        "World's worst explorer",
 		"You can tell everyone you mis-tapped.",
        "Tell me you rushed it",
		"You're not lost, just geographically challenged",
        "You've redefined the word 'miss'.",
		"You can tell everyone you tapped by accident",
        "Sadness.",
        "Ouch.",
        "Btw, the earth is round.",
        "Well, you clicked on the map!",
        "You get a (participation) trophy!",
        "I don't think they speak the same language",
        "Your mother would be so disappointed.",
        "Wah Wah.",
        "When did geography get so hard?",
        "Next time someone asks for directions ... don't.",
        "Exceptional ... ly wrong.",
        "Statistically, random would beat this",
        "Hope you packed for a (very, very) long trip",
        "Did you fail geography class?",
        "I hope you are a great swimmer.",
		"Is your globe from the 1600s?",
		"First time with a globe?",
        "Your GPS just filed for divorce.",
        "Impressively wrong. Almost artistic.",
        "Maps are your nemesis.",
        "Bless your heart.",
        "This is why we can't have nice things.",
        "That's not a guess, that's a cry for help.",
        "Mi englich iz lyk ur jeeografy.",
        "Did you close your eyes and hope for the best?",
        "Eenie Meenie Miney Mo ...",
        "There's no undo button.",
        "Actually, don't tell me what you were thinking.",
        "oh honey no",
        "lol",
        "Nope.",
        "Wait, seriously?",
        "????"
    ];

    const reallyBadText = [
        "Just a 4,000 hour walk",
		"Flat Earthers think you nailed it.",
		"Please say you rushed this",
		"You're not lost, you're exploring!",
		"You tapped! That's ... something.",
		"Your sense of direction needs a miracle.",
        "Maybe next time try with your eyes closed.",
        "You've set a new record for wrong.",
        "Off the charts ... and not in a good way.",
        "Just 3 seconds away! (at the speed of light)",
        "Did you even look at the map?",
        "You were aiming for Earth, right?",
		"You need a hug after that.",
		"At least you didn't tap Antarctica ...",
		"I bet you aren't hitting the share button today ...",
		"These clues are in English ...",
        "You need adult supervision.",
        "Are you ok? Should we call someone?",
        "Play more MapTap?",
        "That's not geography, that's comedy.",
        "Alexa, play Despacito.",
        "I'll tell everyone you were testing.",
        "Have you considered a different hobby?",
        "I'm telling your geography teacher.",
        "We need to talk.",
        "The only thing your guess and the answer share is a planet.",
        "Wow. And I don't mean good wow.",
        "I'm not mad, I'm just disappointed.",
        "Did you mean to open a different app?",
        "¿¿¿¿¿¿¿¿",
        "That tap had 'first day on earth' energy.",
        "bruh",
        "This is why I have trust issues.",
        "That's a hate crime against cartography.",
        "I can't unsee that."
    ];
	
    console.log(`distance is ${distance}`);

    // Helper function to pick text without repeating recent ones
    function pickUniqueText(textArray) {
        // If array is too small, just pick randomly
        if (textArray.length <= 3) {
            return textArray[Math.floor(Math.random() * textArray.length)];
        }

        // Filter out recently used texts
        const available = textArray.filter(text => !window.recentRewardTexts.includes(text));

        // If we've somehow used everything, reset the history
        if (available.length === 0) {
            window.recentRewardTexts = [];
            return textArray[Math.floor(Math.random() * textArray.length)];
        }

        // Pick from available texts
        const selected = available[Math.floor(Math.random() * available.length)];

        // Track this text (keep last 3)
        window.recentRewardTexts.push(selected);
        if (window.recentRewardTexts.length > 3) {
            window.recentRewardTexts.shift(); // Remove oldest
        }

        return selected;
    }

    // Perfect score: clicked inside the country (distance = 0)
    if (distance === 0) return pickUniqueText(perfectText);

    if (distance < 300) return pickUniqueText(greatText);
    if (distance < 900) return pickUniqueText(goodText);
    if (distance < 2500) return pickUniqueText(soSoText);
    if (distance < 6500) return pickUniqueText(badText);
    if (distance < 13000) return pickUniqueText(reallyBadText);

    // Worst case (> 13000km)
    const worstText = [
        "Good thing negative scores aren't a thing.",
        "That's not a guess, that's performance art.",
        "The exact opposite would've been perfect.",
        "You found the antipode. That's the opposite of the answer. Literally.",
        "You'd get there faster by digging.",
        "The ISS is closer to the answer than you are.",
        "That's not geography, that's astronomy."
    ];
    return pickUniqueText(worstText);
}


function finalGradeFlavor(score) {
    if (score > 990) return "Absolutely Amazing!"; 
    if (score > 970) return "Perfection!"; 
    if (score > 950) return "Geographic Master!"; 
    if (score > 930) return "Spectacular!"; 
    if (score > 915) return "Geographer!"; 
    if (score > 900) return "Compass-wielder!"; 
    if (score > 875) return "Great!"; 
    if (score > 800) return "Really good!"; 
    if (score > 750) return ""; 
    if (score > 700) return ""; 
    if (score > 650) return ""; 
    if (score > 600) return ""; 
    if (score > 550) return ""; 
    if (score > 500) return ""; 
    if (score > 450) return ""; 
    if (score > 400) return ""; 
    if (score > 350) return ""; 
    if (score > 300) return ""; 
    if (score > 250) return ""; 
    if (score > 200) return ""; 
    if (score > 150) return ""; 
    if (score > 60) return "So, so bad."; 
	return "Master in disguise.";
}