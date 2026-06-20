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

async function HandleRegister(Event)
{
    Event.preventDefault();

    const Username = document.getElementById('RegUsername').value.trim();
    const Email = document.getElementById('RegEmail').value.trim();
    const Password = document.getElementById('RegPassword').value;
    const ConfirmPassword = document.getElementById('RegConfirmPassword').value;
    const RegisterBtn = document.getElementById('RegisterBtn');
    const Loading = document.getElementById('Loading');
    const ErrorMessage = document.getElementById('ErrorMessage');
    const SuccessMessage = document.getElementById('SuccessMessage');

    ErrorMessage.style.display = 'none';
    SuccessMessage.style.display = 'none';

    if (Password !== ConfirmPassword)
    {
        ShowError('Пароли не совпадают');
        return;
    }

    RegisterBtn.style.display = 'none';
    Loading.style.display = 'block';

    try
    {
        const Response = await fetch('/api/register',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: Username, email: Email, password: Password })
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            localStorage.setItem('ls_token', Data.token);
            localStorage.setItem('ls_username', Data.user.username);
            localStorage.setItem('ls_IsAdmin', Data.user.IsAdmin === true);

            ShowSuccess('Аккаунт создан! Перенаправление...');
            setTimeout(() =>
            {
                window.location.href = '/menu';
            }, 1500);
        }
        else
        {
            ShowError(Data.error || 'Ошибка регистрации');
        }
    }
    catch (Error)
    {
        ShowError('Ошибка подключения к серверу');
        console.error('Register error:', Error);
    }
    finally
    {
        RegisterBtn.style.display = 'block';
        Loading.style.display = 'none';
    }
}

function InitRegister()
{
    document.getElementById('RegisterForm').addEventListener('submit', HandleRegister);
}

InitRegister();
