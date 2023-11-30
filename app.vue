<template>
    <div class="self">
        <div class="tabs">
            <NuxtLink class="home" to="/">Home</NuxtLink>
            <NuxtLink class="home" to="/teambuilder">Teambuilder</NuxtLink>
        </div>

        <NuxtPage />
    </div>
</template>

<style>
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
</style>

<style scoped>
.tabs > * {
    background-color: inherit;
    border: none;
    outline: none;
    cursor: pointer;
    padding: 14px 16px;
    transition: 0.3s;
    text-decoration: none;
    color: black;
}

.tabs *:hover {
    background-color: #ddd;
}

.tabs *.active {
    background-color: #ccc;
}

.tabs *:visited {
    color: black;
}

.tabs {
    display: flex;
    border: 1px solid #ccc;
    background-color: #f1f1f1;
}
</style>
