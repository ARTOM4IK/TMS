let SessionValid = false;
let SavedUsername = null;

function ShowError(Message)
{
    const ErrorMessage = document.getElementById('ErrorMessage');
    ErrorMessage.textContent = Message;
    ErrorMessage.style.display = 'block';
}

function ShowSuccess(Message)
{
    const SuccessMessage = document.getElementById('SuccessMessage');
    SuccessMessage.textContent = Message;
    SuccessMessage.style.display = 'block';
}

function ShowSessionToast(Name)
{
    const Toast = document.getElementById('SessionToast');
    Toast.innerHTML = 'Вы вошли как <span class="Highlight">' + Name + '</span>';
    requestAnimationFrame(() => Toast.classList.add('Visible'));
    setTimeout(() =>
    {
        Toast.classList.remove('Visible');
    }, 4000);
}

async function VerifySavedSession()
{
    const Token = localStorage.getItem('ls_token');
    const Username = localStorage.getItem('ls_username');

    if (!Token || !Username)
        return;

    try
    {
        const Response = await fetch('/api/verify-token',
        {
            headers: { 'Authorization': `Bearer ${Token}` }
        });

        const Data = await Response.json();

        if (Data.valid && !Data.banned)
        {
            SessionValid = true;
            SavedUsername = Data.user ? Data.user.username : Username;
            localStorage.setItem('ls_username', SavedUsername);
            localStorage.setItem('ls_IsAdmin', Data.user && Data.user.IsAdmin === true);
            document.getElementById('Username').value = SavedUsername;
            document.getElementById('Password').removeAttribute('required');
            ShowSessionToast(SavedUsername);
        }
        else
        {
            localStorage.removeItem('ls_token');
            localStorage.removeItem('ls_username');
            localStorage.removeItem('ls_IsAdmin');
        }
    }
    catch (Error)
    {
        console.error('Token verify error:', Error);
    }
}

async function HandleLogin(Event)
{
    Event.preventDefault();

    const ErrorMessage = document.getElementById('ErrorMessage');
    const SuccessMessage = document.getElementById('SuccessMessage');
    const LoginBtn = document.getElementById('LoginBtn');
    const Loading = document.getElementById('Loading');

    ErrorMessage.style.display = 'none';
    SuccessMessage.style.display = 'none';

    if (SessionValid)
    {
        window.location.href = '/menu';
        return;
    }

    const Username = document.getElementById('Username').value.trim();
    const Password = document.getElementById('Password').value;

    if (!Username || !Password)
    {
        ShowError('Введите имя пользователя и пароль');
        return;
    }

    LoginBtn.style.display = 'none';
    Loading.style.display = 'block';

    try
    {
        const Response = await fetch('/api/login',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: Username, password: Password })
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            localStorage.setItem('ls_token', Data.token);
            localStorage.setItem('ls_username', Data.user.username);
            localStorage.setItem('ls_IsAdmin', Data.user.IsAdmin === true);

            SuccessMessage.textContent = 'Вход выполнен! Перенаправление...';
            SuccessMessage.style.display = 'block';

            window.location.href = '/menu';
        }
        else
        {
            ShowError(Data.error || 'Ошибка входа');
        }
    }
    catch (Error)
    {
        ShowError('Ошибка подключения');
        console.error('Login error:', Error);
    }
    finally
    {
        LoginBtn.style.display = 'block';
        Loading.style.display = 'none';
    }
}

function InitLogin()
{
    document.getElementById('LoginForm').addEventListener('submit', HandleLogin);
    VerifySavedSession();
}

InitLogin();
