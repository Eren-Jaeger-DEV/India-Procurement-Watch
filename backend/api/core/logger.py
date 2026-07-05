import os
import logging
from logging.handlers import RotatingFileHandler

def setup_logger():
    # Define the log directory based on the location of this file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_dir = os.path.join(base_dir, 'logs')
    
    # Create the logs directory if it doesn't exist
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    log_file = os.path.join(log_dir, 'ipw.log')

    # Set up the logger
    logger = logging.getLogger('ipw_backend')
    logger.setLevel(logging.INFO)

    # To avoid duplicate logs if this is called multiple times
    if not logger.handlers:
        # Create a rotating file handler: max 10MB per file, keeping up to 5 old logs
        file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
        
        # Define the exact format we want for the Discord Bot to parse
        formatter = logging.Formatter(
            '[%(asctime)s] | %(levelname)s | %(message)s', 
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(formatter)
        
        # Add the file handler to the logger
        logger.addHandler(file_handler)
        
        # We can also add a stream handler if we still want console output
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

    return logger
