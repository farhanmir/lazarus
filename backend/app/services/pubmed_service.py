"""PubMed verification service to trap AI hallucinations."""

import re
import urllib.request
import json
from typing import List

def extract_pmids(text: str) -> List[str]:
    """Extract PMIDs from a block of text."""
    # Pattern looks for PMID: followed by 7 to 9 digits
    return re.findall(r'PMID:\s*(\d{7,9})', text, re.IGNORECASE)

def check_hallucinated_citations(text: str) -> tuple[bool, List[str]]:
    """
    Checks if any extracted PMIDs are fake.
    Returns: (is_hallucinated, list_of_fake_pmids)
    """
    pmids = extract_pmids(text)
    if not pmids:
        return False, []
    
    unique_pmids = list(set(pmids))
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={','.join(unique_pmids)}&retmode=json"
    
    fake_pmids = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'LazarusSwarm/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            result = data.get('result', {})
            
            for pmid in unique_pmids:
                if pmid not in result or 'error' in result[pmid]:
                    fake_pmids.append(pmid)
                    
            if fake_pmids:
                return True, fake_pmids
            return False, []
    except Exception:
        # If the NCBI API is down, we fail open so the demo doesn't crash from network errors.
        return False, []
