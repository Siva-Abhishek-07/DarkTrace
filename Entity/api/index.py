import sys
import os

ENTITY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ENTITY_DIR)

from app import app
