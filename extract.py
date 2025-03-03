import requests
from bs4 import BeautifulSoup
import pandas as pd
import sqlite3
import json
import re
import time
from typing import Dict, List, Optional, Union, Any

def get_soup(url: str) -> BeautifulSoup:

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers)
    return BeautifulSoup(response.text, 'html.parser')

def clean_box_office(box_office_str: str) -> Optional[float]:
    """
    Clean box office string and convert to float.
    
    Args:
        box_office_str: String containing box office value
        
    Returns:
        Cleaned box office value as float or None if conversion fails
    """
    if '$' in box_office_str:
        box_office_str = box_office_str[box_office_str.find('$'):]
    
    clean_str = re.sub(r'[^\d.]', '', box_office_str)
    try:
        return float(clean_str) if clean_str else None
    except ValueError:
        return None

def extract_year_from_text(text: str) -> Optional[int]:
    year_match = re.search(r'\((\d{4})\)', text)
    if year_match:
        return int(year_match.group(1))
    
    year_match = re.search(r'\b(19\d{2}|20\d{2})\b', text)
    return int(year_match.group(1)) if year_match else None

def get_film_details(film_url: str) -> Dict[str, Any]:
    details = {
        'director': 'Unknown',
        'country': 'Unknown'
    }
    
    try:
        film_soup = get_soup(f"https://en.wikipedia.org{film_url}")
        
        infobox = film_soup.find('table', class_='infobox')
        if infobox:
            director_row = infobox.find('th', string=re.compile(r'Direct(ed by|or)'))
            if director_row:
                director_cell = director_row.find_next('td')
                if director_cell:
                    directors = [d.strip() for d in director_cell.text.strip().split('\n')]
                    details['director'] = ', '.join(directors)
            
            country_row = infobox.find('th', string=re.compile(r'Countr(y|ies)'))
            if country_row:
                country_cell = country_row.find_next('td')
                if country_cell:
                    country_list = country_cell.find('ul')
                    if country_list:
                        first_country_item = country_list.find('li')
                        if first_country_item:
                            country_text = re.sub(r'\[\d+\]', '', first_country_item.get_text())
                            details['country'] = country_text.strip()
                    else:
                        for br in country_cell.find_all('br'):
                            br.replace_with('\n')
                        
                        country_text = country_cell.get_text()
                        country_text = re.sub(r'\[\d+\]', '', country_text)
                        countries = re.split(r'[,\n]', country_text)
                        first_country = countries[0].strip() if countries else 'Unknown'
                        details['country'] = first_country
        
        if details['director'] == 'Unknown':
            first_para = film_soup.find('div', class_='mw-parser-output').find('p')
            if first_para:
                director_match = re.search(r'directed by ([^.]+)', first_para.text)
                if director_match:
                    details['director'] = director_match.group(1).strip()
        
        if details['country'] == 'Unknown':
            first_para = film_soup.find('div', class_='mw-parser-output').find('p')
            if first_para:
                country_match = re.search(r'(?:is a|a \d{4})(?: [^.]+?)? ([^.]+?) (?:film|movie)', first_para.text)
                if country_match:
                    country_text = country_match.group(1).strip()
                    country_text = re.sub(r'\[\d+\]', '', country_text)
                    countries = re.split(r'[,\n]', country_text)
                    first_country = countries[0].strip() if countries else 'Unknown'
                    details['country'] = first_country
    
    except Exception as e:
        print(f"Error extracting details from {film_url}: {e}")
    
    return details

def main():
    url = "https://en.wikipedia.org/wiki/List_of_highest-grossing_films"
    soup = get_soup(url)
    
    tables = soup.find_all('table', class_='wikitable')
    main_table = None
    
    for table in tables:
        headers = [th.text.strip() for th in table.find_all('th')]
        if 'Rank' in headers and 'Title' in headers and 'Worldwide gross' in headers:
            main_table = table
            break
    
    if not main_table:
        print("Could not find the main table with film data")
        return
    
    films_data = []
    
    for row in main_table.find_all('tr')[1:]:
        cells = row.find_all(['td', 'th'])
        if len(cells) >= 4:
            try:
                rank = cells[0].text.strip()
                if not rank.isdigit():
                    continue
                
                title_cell = cells[2]
                title_link = title_cell.find('a')
                
                if not title_link:
                    continue
                
                title = title_link.text.strip()
                film_url = title_link.get('href')
                
                box_office_cell = cells[3]
                box_office_str = box_office_cell.text.strip()
                box_office = clean_box_office(box_office_str)
                
                year_cell = cells[4] if len(cells) > 4 else None
                year = int(year_cell.text.strip()) if year_cell and year_cell.text.strip().isdigit() else None
                
                if not year:
                    year = extract_year_from_text(title)
                
                print(f"Fetching details for {title}...")
                film_details = get_film_details(film_url)
                
                films_data.append({
                    'title': title,
                    'release_year': year,
                    'director': film_details['director'],
                    'box_office': box_office,
                    'country': film_details['country']
                })
                
                time.sleep(1)
                
            except Exception as e:
                print(f"Error processing row: {e}")
    
    conn = sqlite3.connect('highest_grossing_films.db')
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS films (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        release_year INTEGER,
        director TEXT,
        box_office REAL,
        country TEXT
    )
    ''')
    
    cursor.execute('DELETE FROM films')
    
    for film in films_data:
        cursor.execute('''
        INSERT INTO films (title, release_year, director, box_office, country)
        VALUES (?, ?, ?, ?, ?)
        ''', (
            film['title'],
            film['release_year'],
            film['director'],
            film['box_office'],
            film['country']
        ))
    
    conn.commit()
    
    with open('films_data.json', 'w', encoding='utf-8') as f:
        json.dump(films_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully extracted data for {len(films_data)} films")
    conn.close()

if __name__ == "__main__":
    main()