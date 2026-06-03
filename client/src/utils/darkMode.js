export const enableDarkMode = () => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('theme', 'dark');
};

export const disableDarkMode = () => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('theme', 'light');
};

export const isDarkModeEnabled = () => {
  return localStorage.getItem('theme') === 'dark';
};
