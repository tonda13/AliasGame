FROM php:8.2-apache

# PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# Apache modules
RUN a2enmod rewrite deflate expires headers

# Apache config
COPY vhost.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html
