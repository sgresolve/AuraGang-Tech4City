from transformers import DistilBertTokenizer, DistilBertForSequenceClassification, TrainingArguments, Trainer
from datasets import Dataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import torch
import os

# Ensure model directory exists
MODEL_DIR = './category_classifier_model'
os.makedirs(MODEL_DIR, exist_ok=True)

# Define the dataset (keeping your original descriptions)
descriptions = [#Pothole
"There’s a big pothole on Orchard Road near Somerset MRT, it’s very serious."
"There’s a huge hole on Bukit Timah Road that has damaged my car tire."
"There is a deep pothole on the pavement at Jurong East Ave 1, and I almost tripped."
"I hit a pothole on Tampines Street 21 last night—it’s dangerous, especially since it’s so dark."
"There’s a crater-like pothole at the corner of Serangoon Road and Rangoon Road, it’s terrible."
"There’s a big hole on Woodlands Ave 7 causing flat tires, it needs to be fixed."
"The road at Bedok North Ave 3 has a pothole, it’s so bumpy that it gives me a headache."
"There’s a pothole near the bus stop at Boon Lay Way, and despite complaints, it still hasn’t been repaired."
"There’s a massive hole on Changi Road, a motorbike almost crashed into it."
"There’s a pothole outside the HDB at Hougang Ave 8, cars get stuck there every day."
"I noticed a deep pothole on Jalan Bukit Merah, it’s very serious and almost wrecked my car."
"There’s a pothole in the lane at Eunos Crescent, making the ride very rough."
"There’s a pothole on Clementi Road that’s so bad it damaged my car’s suspension, I can’t stand it."
"I spotted a pothole near the shopping mall in Choa Chu Kang, it’s disturbing my drive."
"There’s a nasty pothole at Sengkang East Way, it needs to be fixed quickly to avoid accidents."
"I saw a pothole at Queenstown Rd, it’s very large and dangerous."
"The street near Ang Mo Kio Town Centre has a pothole, the ride is bumpy and gives me a headache."
"I spotted a pothole on Jalan Eunos, it’s really deep and almost burst my tire."
"At Pasir Ris, I found a pothole by the park, and now people are afraid to drive there."
"There’s a deep pothole on the side of Clementi Ave 3, it’s dangerous and needs to be repaired immediately."
#Street Light Outage
"The street light outside my HDB in Bedok hasn’t been working for two days."
"The street lamp on Ang Mo Kio Ave 3 is completely out, it’s pitch black."
"There’s no light along Yishun Ring Road since last week, it’s very creepy."
"The streetlight at Toa Payoh Lorong 6 keeps flickering and then goes off."
"There’s a broken street light on Pasir Ris Drive 1, it’s very dark at night."
"The streetlights along Choa Chu Kang Ave 4 are all out, I can’t see anything."
"The lamp at Clementi Ave 5 is broken, walking home is scary."
"There’s no street light at Jurong West St 41, even the kids playing there can’t see."
"The streetlight near Sengkang MRT keeps blinking and is now completely off."
"The whole stretch of Marine Drive has no lights, it’s like a haunted place."
"The street light at Paya Lebar Road has been out for days, leaving the area pitch black."
"The lamp outside my block in Boon Lay never turns on, it’s worrying."
"There’s no street lamp on Tiong Bahru Road, the area is very dark and scary."
"The lamp at Bedok South Ave 3 is out, now the whole street looks like a ghost town."
"The street light at Yio Chu Kang is out, it’s disturbing my evening walk."
"The street lamps along Sembawang Road are all out, making driving dangerous."
"The lamp near Jurong East MRT isn’t working, everyone is complaining."
"The broken light on Woodlands Street makes it so dark that even cats can’t see."
"The street light in Punggol sometimes works and then suddenly goes out, it’s very annoying."
"There’s no functioning lamp at Clementi Road, the area is completely dark and needs to be replaced."
#Graffiti
"There’s offensive graffiti painted on the void deck wall at Clementi HDB."
"Someone spray-painted rude words on the bench at Bishan Park."
"There’s graffiti all over the shop wall at Bugis Street, it’s very ugly."
"There’s vandalism with paint on the school fence at Hougang, it needs to be cleaned."
"The underpass near Lavender MRT has been tagged with colorful graffiti."
"Spray paint has ruined the bus stop at Punggol Road, who did this?"
"There’s graffiti on the wall at Tiong Bahru market, it’s very unsightly."
"Someone drew nonsense on the HDB staircase at Woodlands, it’s very irritating."
"The playground at Tampines has been spray-painted all over, the kids are scared."
"There’s graffiti on the bridge near Kallang River, it’s so messy I can’t stand it."
"There’s offensive spray paint on the MRT station wall at Jurong East."
"Graffiti has been tagged on the wall outside the coffee shop in Ang Mo Kio, it’s very shameless."
"Someone scribbled vulgar words on the community centre at Paya Lebar."
"There’s graffiti on the back of a bus stop in Yishun, it’s annoying and needs to be cleaned up."
"There are ugly tags on the fence at Serangoon Plaza, it really spoils the view."
"There’s random graffiti on the wall of a hawker centre in Bedok, it disturbs the ambiance."
"There’s tagging on the mural at Toa Payoh, it’s childish but messy."
"Someone sprayed a crude message on the wall at Sengkang, it’s very offensive."
"There’s vandalized paint on the wall outside a wet market in Little India, it’s really unsightly."
"There’s graffiti on the staircase of an HDB block in Bishan, it’s very disrespectful."
#Abandoned Vehicle
"There’s a car left at Jalan Besar carpark for over a month."
"There’s an old truck parked and abandoned at Sengkang East Way for a long time."
"There’s a rusty van sitting at Geylang Lorong 20 for weeks."
"A broken-down sedan hasn’t moved from Tiong Bahru Road, it’s very unsightly."
"Someone abandoned a motorcycle at Marine Parade, it’s been there forever."
"There’s an abandoned SUV blocking the lane near Jurong West St 52."
"There’s an old lorry parked at Pasir Panjang Road, collecting dust."
"There’s a beat-up car at Bukit Batok St 21 that nobody has claimed for months."
"A motorcycle has been left at the carpark near Yishun MRT, it’s very messy."
"There’s a taxi abandoned at Serangoon Central, it hasn’t been towed away for a long time."
"There’s a rusty pickup truck abandoned on the side of Tampines Ave, it really needs to be cleared up."
"There’s a broken van sitting idle at Hougang Street, blocking traffic and causing delays."
"There’s a dilapidated car parked at Ang Mo Kio that nobody has claimed for ages."
"There’s an abandoned motorcycle on Jurong Hill Road, it’s been there so long that people are complaining."
"There’s an old taxi left at Yio Chu Kang, creating a nuisance for everyone."
"There’s an unused car at Punggol Field, left for weeks, obstructing the road."
"There’s a rusty SUV on the verge of falling apart at Bedok North, it must be towed away."
"There’s an abandoned lorry on Sembawang Road, turning the lane into a parking lot, it’s very messy."
"There’s an old sedan left unattended at Clementi Central, really jamming up the area."
"There’s a forgotten mini-van on Holland Road, in the middle of the road, it needs immediate removal."
#Illegal Dumping
"There are trash bags dumped at the back lane of my HDB in Queenstown."
"There are piles of rubbish scattered near the canal at Sungei Kadut, it’s very smelly."
"Someone threw an old sofa at the empty lot along Commonwealth Ave."
"There’s a heap of junk illegally dumped near the East Coast Park entrance."
"There are mattresses and trash clogging the drain at Sembawang, it’s very dirty."
"There are discarded tires piled up at Kranji Road, it’s very messy."
"There are rubbish bags thrown near the playground at Ang Mo Kio, it’s very smelly."
"There’s an old fridge and boxes dumped at Bukit Panjang, blocking the path."
"Someone left construction debris at Punggol Field, it’s very inconsiderate."
"There’s trash scattered all over the grass patch at Bedok Reservoir, it’s terrible."
"There’s illegal dumping of cardboard boxes at Changi Business Park, it really clutters the area."
"Someone dumped broken furniture at Yishun Street, it’s very irresponsible."
"There’s junk piled up at the Woodlands industrial area, making the place look trashy."
"There are piles of old appliances dumped near Toa Payoh, disturbing the neighborhood."
"There’s a large heap of rubbish along Jurong Island, causing environmental issues."
"There’s construction waste thrown on the side of Serangoon Road, it’s very messy."
"There are old mattresses and broken items dumped at the Tampines industrial zone, it’s very unsightly."
"There are discarded electronics piled at Paya Lebar, creating a hazardous scene."
"Someone dumped food waste near the park at Bedok, it smells very bad."
"There’s illegal waste dumped on the verge of Sembawang, polluting the view, it must be removed."
#Noise Complaint
"My neighbor plays loud music every night, I can’t sleep."
"There’s a dog downstairs at Bukit Batok that keeps barking non-stop."
"Construction noise at Admiralty Road wakes me up very early."
"There’s a party at the HDB flat in Redhill blasting music until 3 AM."
"There’s loud shouting from upstairs at Woodlands every day."
"Noisy renovation works at Kallang Bahru all day give me a headache."
"The neighbor at Jurong East does karaoke until midnight, it’s very noisy."
"Kids are screaming and running at the void deck in Sengkang, it’s very irritating."
"There’s loud drilling at Choa Chu Kang all day, it never stops."
"Someone is honking their car horn non-stop at Toa Payoh, it’s very annoying."
"There’s loud bass from the club in Clarke Quay, disturbing the whole area."
"There’s constant barking from stray dogs at Yishun, disturbing the peace."
"There’s loud hammering noise at the Bedok construction site, causing early morning disturbance."
"The neighbor’s flat in Ang Mo Kio is always blasting rock music, it gives me a headache."
"There’s a screeching sound from the elevator at Bishan, it’s so loud it disturbs my sleep."
"There’s noise from a nearby carnival at Sentosa, blaring music all night, I can’t stand it."
"The constant honking from traffic near Orchard Road is so irritating, it makes me feel sick."
"There’s a loud party at the Hougang HDB, music blasting until dawn, it’s very disruptive."
"There’s unrelenting noise from a roadside stall in Jurong, disturbing the neighborhood’s peace."
"There’s continuous drilling noise at the Yishun industrial area, giving me a headache and making it hard to concentrate."
#Other
"There’s a stray dog barking near my block at Marsiling."
"The walkway at Bukit Panjang is blocked by fallen tree branches."
"There’s a very smelly stench from the drain at Little India."
"There’s a swarm of bees nesting in the tree at Sentosa Cove, it’s scary."
"There’s a leaking pipe near Kembangan MRT flooding the path, it’s very wet."
"There’s broken glass all over the cycling path at Punggol Waterway, it’s dangerous."
"There’s a monkey stealing food near the HDB at Bukit Timah."
"The lift at Bishan HDB keeps making weird noises."
"A big bird flew into my window at Pasir Ris, now the glass is cracked."
"There’s a flood near the market at Serangoon North, water is everywhere."
"There’s a lost parrot flying around Marina Bay, causing quite the commotion."
"There’s an overflowing manhole at Tiong Bahru, water is everywhere, it’s very messy."
"There’s a stray cat roaming around Holland Village, it gave me a fright."
"There’s a pile of leaves blocking the walkway at MacPherson, it’s not neat and needs to be cleared."
"There’s unexpected hail at Jurong East, it’s wet and cold, really out of place."
"There’s a broken bench at Mountbatten Park, it’s become a hazard for the elderly."
"There’s a wild squirrel running across the street at Pasir Ris, it’s funny but dangerous."
"There’s a pest infestation at the hawker centre in Geylang, it’s very nasty and needs pest control."
"There’s water leakage from a rooftop at Serangoon, the drip drip sound is annoyingly persistent."
"There’s a fallen signboard at Woodlands blocking the pathway, it must be fixed quickly."
]

# Define new categories
new_categories = []
for idx in range(140):
    if 0 <= idx < 20:  # Pothole
        new_categories.append("Infrastructure")
    elif 20 <= idx < 40:  # Street Light Outage
        new_categories.append("Infrastructure")
    elif 40 <= idx < 60:  # Graffiti
        new_categories.append("Others")
    elif 60 <= idx < 80:  # Abandoned Vehicle
        new_categories.append("Safety")
    elif 80 <= idx < 100:  # Illegal Dumping
        new_categories.append("Environmental")
    elif 100 <= idx < 120:  # Noise Complaint
        new_categories.append("Others")
    else:  # Other (indices 120-139)
        if idx == 120:  # Stray dog
            new_categories.append("Infestation")
        elif idx == 121:  # Fallen tree branches
            new_categories.append("Safety")
        elif idx == 122:  # Smelly drain
            new_categories.append("Environmental")
        elif idx == 123:  # Bees
            new_categories.append("Infestation")
        elif idx == 124:  # Leaking pipe
            new_categories.append("Infrastructure")
        elif idx == 125:  # Broken glass
            new_categories.append("Safety")
        elif idx == 126:  # Monkey
            new_categories.append("Infestation")
        elif idx == 127:  # Lift noise
            new_categories.append("Infrastructure")
        elif idx == 128:  # Bird flying into window
            new_categories.append("Others")
        elif idx == 129:  # Flood
            new_categories.append("Environmental")
        elif idx == 130:  # Lost parrot
            new_categories.append("Others")
        elif idx == 131:  # Overflowing manhole
            new_categories.append("Environmental")
        elif idx == 132:  # Stray cat
            new_categories.append("Infestation")
        elif idx == 133:  # Pile of leaves
            new_categories.append("Environmental")
        elif idx == 134:  # Hail
            new_categories.append("Others")
        elif idx == 135:  # Broken bench
            new_categories.append("Safety")
        elif idx == 136:  # Squirrel
            new_categories.append("Others")
        elif idx == 137:  # Pest infestation
            new_categories.append("Infestation")
        elif idx == 138:  # Water leakage
            new_categories.append("Infrastructure")
        elif idx == 139:  # Fallen signboard
            new_categories.append("Safety")

# Tokenizer setup
tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')
category_to_label = {category: idx for idx, category in enumerate(["Infrastructure", "Safety", "Environmental", "Infestation", "Others"])}
labels = [category_to_label[category] for category in new_categories]

# Stratified split for balanced dataset
train_desc, eval_desc, train_labels, eval_labels = train_test_split(
    descriptions, labels, test_size=0.2, random_state=42, stratify=labels
)

# Tokenize
train_encodings = tokenizer(train_desc, truncation=True, padding=True, return_tensors='pt')
eval_encodings = tokenizer(eval_desc, truncation=True, padding=True, return_tensors='pt')

train_dataset = Dataset.from_dict({
    'input_ids': train_encodings['input_ids'],
    'attention_mask': train_encodings['attention_mask'],
    'labels': torch.tensor(train_labels)
})
eval_dataset = Dataset.from_dict({
    'input_ids': eval_encodings['input_ids'],
    'attention_mask': eval_encodings['attention_mask'],
    'labels': torch.tensor(eval_labels)
})

# Model setup with 5 categories
num_labels = 5
model = DistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased', num_labels=num_labels)

# Define compute_metrics function for accuracy
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = torch.argmax(torch.tensor(logits), dim=-1)
    acc = accuracy_score(labels, predictions)
    return {"accuracy": acc}

# Training arguments
training_args = TrainingArguments(
    output_dir='./results',
    num_train_epochs=10,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    warmup_steps=5,
    weight_decay=0.01,
    logging_dir='./logs',
    logging_steps=5,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    greater_is_better=True,
    learning_rate=2e-5
)

# Train the model
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    compute_metrics=compute_metrics
)
trainer.train()

# Save the trained model and tokenizer
model.save_pretrained(MODEL_DIR)
tokenizer.save_pretrained(MODEL_DIR)

print(f"Model saved successfully to {MODEL_DIR}")

# Print evaluation results
eval_results = trainer.evaluate()
print("Evaluation results:", eval_results)