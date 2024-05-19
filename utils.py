import re
import joblib
import pandas as pd
from bs4 import BeautifulSoup
import requests
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
from django.conf import settings
import os
import joblib
import time


# model_path = os.path.join(settings.BASE_DIR, 'app', 'static', 'model.pkl')
# vectorizer_path = os.path.join(settings.BASE_DIR, 'app', 'static', 'vectorizer.pkl')


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(BASE_DIR, "static", "model.pkl")
vectorizer_path = os.path.join(BASE_DIR, "static", "tfidf_vectorizer.pkl")

print("Model Path:", model_path)
print("Vectorizer Path:", vectorizer_path)
# Load phishing keywords and safe keywords
most_common_phishing_words = joblib.load(os.path.join(BASE_DIR, "static", "phishing_keywords.pkl"))
most_common_safe_words = joblib.load(os.path.join(BASE_DIR, "static", "safe_keywords.pkl"))

# Load the trained model and text vectorizer
model_pipeline = joblib.load(model_path)
tfidf_vectorizer = joblib.load(vectorizer_path)

# Load the label encoder
label_encoder = joblib.load(os.path.join(BASE_DIR, "static", "label_encoder.pkl"))

# Initialize the WordNetLemmatizer
lemmatizer = WordNetLemmatizer()

try:
    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
    print("Model and vectorizer loaded successfully.")
except FileNotFoundError as e:
    print(e)
    print("Failed to load the model or vectorizer.")
except Exception as e:
    print("An error occurred:", e)

# Text preprocessing
def preprocess_text(text):
    stop_words = set(stopwords.words("english"))
    tokens = word_tokenize(text)
    tokens = [token.lower() for token in tokens if token.isalpha()]
    
    # Initialize the lemmatizer
    lemmatizer = WordNetLemmatizer()
    
    tokens = [
        lemmatizer.lemmatize(token) for token in tokens if token not in stop_words
    ]
    return " ".join(tokens)

def check_keyword_presence(text, keywords):
    count = 0
    for keyword in keywords:
        if keyword.lower() in text.lower():  # Convert both to lower case to make the search case-insensitive
            count += 1
            if count >= 5:  # If at least 5 keywords are found, return 1
                return 1
    return 0

def extract_features(df):
    # Assuming df is a DataFrame with processed_message and message columns
    # Definitions of most_common_phishing_words and most_common_safe_words should be available

    # Total number of words, characters, and distinct words in the email body
    df['body_word_count'] = df['processed_message'].apply(lambda x: len(x.split()))
    df['body_char_count'] = df['processed_message'].apply(len)
    df['body_distinct_word_count'] = df['processed_message'].apply(lambda x: len(set(x.split())))
    
    # Presence of specific keywords in the email body
    phishing_keywords = [word for word, _ in most_common_phishing_words]
    safe_keywords = [word for word, _ in most_common_safe_words]
    df['phishing_keyword_presence'] = df['processed_message'].apply(lambda x: check_keyword_presence(x, phishing_keywords))
    df['safe_keyword_presence'] = df['processed_message'].apply(lambda x: check_keyword_presence(x, safe_keywords))
    
    # Presence of HTML tags or forms in the email body
    df['html_tags_presence'] = df['message'].apply(lambda x: 1 if re.search(r'<.*?>', x) else 0)
    df['forms_presence'] = df['processed_message'].apply(lambda x: 1 if 'form' in x else 0)
    
    # Presence of IP addresses and URLs
    df['ip_address_presence'] = df['message'].apply(lambda x: 1 if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', x) else 0)
    df['num_links'] = df['message'].apply(lambda x: len(re.findall(r'https?://\S+', x)))
    
    # Presence of JavaScript
    df['javascript_presence'] = df['message'].apply(lambda x: 1 if 'script' in x.lower() else 0)
    
    return df


def predict(text):
    # Preprocess input data
    processed_data = preprocess_text(text)
    
    # Create DataFrame
    new_data = pd.DataFrame({"processed_message": [processed_data], "message": [text]})
    new_data = extract_features(new_data)
    
    # Make prediction using a preloaded model pipeline
    prediction = model_pipeline.predict(new_data)
    
    # Decode prediction using a preloaded label encoder
    decoded_prediction = label_encoder.inverse_transform(prediction)
    
    return decoded_prediction[0]


def remove_hidden_html_styles(html_content):
    print(html_content)
    soup = BeautifulSoup(html_content, 'html.parser')
    # Define a comprehensive list of styles that typically indicate hidden content
    hidden_styles = [
        'mso-hide:all', 'display:none !important', 'font-size:0','font:0', 'max-height:0', 
        'line-height:0', 'visibility:hidden', 'overflow:hidden', 'opacity:0', 
        'color:transparent', 'height:0', 'width:0'
    ]
    for tag in soup.find_all(style=True):
        if any(style in tag['style'] for style in hidden_styles):
            tag.decompose()
    return str(soup)


def extract_urls(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    urls = [link['href'] for link in soup.find_all('a', href=True)]
    return urls

'''
# def scan_url_with_virustotal(url, api_key="4238d0a0e543ca66763add4cb7361682d0b82ec514510215e1e8b7714441e912"):
    scan_url_endpoint = "https://www.virustotal.com/vtapi/v2/url/scan"
    headers = {"Content-Type": "application/json"}
    params = {"apikey": api_key, "url": url}
    
    response = requests.post(scan_url_endpoint, headers=headers, json=params)
    if response.status_code == 200:
        report_params = {"apikey": api_key, "resource": response.json()['scan_id']}
        report_endpoint = "https://www.virustotal.com/vtapi/v2/url/report"
        report_response = requests.get(report_endpoint, params=report_params)
        if report_response.status_code == 200:
            report_data = report_response.json()
            
            # Check the total number of detections
            positives = report_data.get('positives', 0)
            if positives >= 5:
                print("This is a phishing email.")
            return report_data
    return None
'''

def scan_url_with_virustotal(url, api_key="7899c1bff18f7f96bef37c3869f9e1a51fc95845eb8d9ebc81a52ca13764ca3f"):
    scan_url_endpoint = "https://www.virustotal.com/vtapi/v2/url/scan"
    scan_report_endpoint = "https://www.virustotal.com/vtapi/v2/url/report"

    params = {
        "apikey": api_key,
        "url": url
    }

    # Submit URL for scanning
    response = requests.post(scan_url_endpoint, data=params)
    print("Response",response)
    response.raise_for_status()  
    try:
        json_response = response.json()
    except requests.exceptions.JSONDecodeError:
        print(f"Error decoding JSON response for URL scan: {response.text}")
        return None


    scan_id = json_response.get("scan_id")
    if scan_id:
        # Retrieve scan report
        params = {
            "apikey": api_key,
            "resource": scan_id
        }

        # Poll the report until it's ready
        while True:
            response = requests.get(scan_report_endpoint, params=params)
            try:
                json_response = response.json()
            except requests.exceptions.JSONDecodeError:
                print(f"Error decoding JSON response for scan report: {response.text}")
                return None

            if json_response.get("response_code") == 1:
                break

        # Process the scan results
        positives = json_response.get("positives", 0)
        total = json_response.get("total", 0)

        print(f"URL: {url}")
        print(f"Scan results: {positives}/{total} scanners detected this URL as malicious.\n")
        
        if positives >= 5:
            print("This is a phishing email.")
        
        return json_response
    else:
        print(f"Failed to submit URL for scanning: {url}\n")
    
    return None

