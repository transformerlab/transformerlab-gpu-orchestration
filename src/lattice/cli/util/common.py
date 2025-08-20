import math
from rich.console import Console
from rich.text import Text

# Define the ASCII art for the "lab.cloud" logo.
# You can generate your own at many websites like patorjk.com/software/taag/
LOGO = r"""
  _       _          _                 _ 
 | |     | |        | |               | |
 | | __ _| |__   ___| | ___  _   _  __| |
 | |/ _` | '_ \ / __| |/ _ \| | | |/ _` |
 | | (_| | |_) | (__| | (_) | |_| | (_| |
 |_|\__,_|_.__(_)___|_|\___/ \__,_|\__,_|         
"""

console = Console()


def generate_rainbow_text(text: str, time_step: float) -> Text:
    """
    Generates a rich.text.Text object with a rainbow effect.

    Args:
        text (str): The input ASCII art.
        time_step (float): A time-based value to animate the colors.

    Returns:
        Text: A Text object ready to be printed to the console.
    """
    rainbow_text = Text()
    lines = text.splitlines()

    # Iterate over each character in the ASCII art
    for y, line in enumerate(lines):
        for x, char in enumerate(line):
            # Skip spaces to maintain the shape of the logo
            if char.isspace():
                rainbow_text.append(char)
                continue

            # --- Rainbow Color Calculation ---
            # We use sine waves to generate smooth, cycling RGB color values.
            frequency = 0.1
            red = int((math.sin(frequency * x + time_step) + 1) / 2 * 255)
            green = int(
                (math.sin(frequency * x + time_step + 2 * math.pi / 3) + 1) / 2 * 255
            )
            blue = int(
                (math.sin(frequency * x + time_step + 4 * math.pi / 3) + 1) / 2 * 255
            )

            # Create an RGB color string for rich
            color = f"rgb({red},{green},{blue})"

            # Append the character with its calculated color
            rainbow_text.append(char, style=color)

        # Add a newline after each line of the logo
        rainbow_text.append("\n")

    return rainbow_text


def show_header():
    """
    Displays the lab.cloud logo with a rainbow effect.
    """
    console.print(generate_rainbow_text(LOGO, 0), justify="center")
